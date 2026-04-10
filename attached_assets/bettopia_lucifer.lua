-- BetTopia Deposit Bot
-- Lucifer v2.83 p2
-- Player drops DLs/BGLs/WLs on the ground, bot walks over them to collect.
-- Inventory polling confirms receipt, then credits the deposit.

local WEBSITE_URL = "https://case-topia.replit.app"
local BOT_SECRET  = "0d68e6d0b7388733c797bfbe76ad3e5e2f3917de52365871ac1f3d7685f8037e"
local BOT_GROW_ID = "zPlaysGT"

local ITEM_BGL = 4532 -- Blue Gem Lock  (= 100 DL)
local ITEM_DL  = 1796 -- Diamond Lock   (= 1 DL)
local ITEM_WL  = 242  -- World Lock     (= 0.01 DL)

local DEPOSIT_DURATION = 120 -- seconds the player has to drop after bot joins

local claimed_worlds = {}
local processing_wd  = {}
local activeDeposit  = nil

local function api_get(path, params)
    local sep = path:find("?") and "&" or "?"
    local url = WEBSITE_URL .. "/api" .. path .. sep .. "secret=" .. BOT_SECRET
    if params then url = url .. "&" .. params end
    local ok, res = pcall(function()
        local h = io.popen('curl -s "' .. url .. '"')
        local r = h:read("*a")
        h:close()
        return r
    end)
    if not ok or not res then return nil end
    return res
end

local function api_post(path, params)
    local url = WEBSITE_URL .. "/api" .. path .. "?secret=" .. BOT_SECRET
    if params then url = url .. "&" .. params end
    local ok, res = pcall(function()
        local h = io.popen('curl -s -X POST --data "" "' .. url .. '"')
        local r = h:read("*a")
        h:close()
        return r
    end)
    if not ok or not res then return nil end
    return res
end

local function inv_snapshot(bot)
    local inv = bot:getInventory()
    return inv:getItemCount(ITEM_BGL), inv:getItemCount(ITEM_DL), inv:getItemCount(ITEM_WL)
end

-- Collect every dropped DL/BGL/WL in the world
local function collect_dropped_items(bot)
    local ok, world = pcall(function() return bot:getWorld() end)
    if not ok or not world then return end
    local ok2, objs = pcall(function() return world:getObjects() end)
    if not ok2 or not objs then return end
    local ok3, sz = pcall(function() return objs:size() end)
    if not ok3 or not sz then return end
    for i = 1, sz do
        local ok4, obj = pcall(function() return objs:get(i) end)
        if ok4 and obj then
            local id = obj.id
            if id == ITEM_BGL or id == ITEM_DL or id == ITEM_WL then
                local px = math.floor(obj.x)
                local py = math.floor(obj.y)
                local tx = math.floor(px / 32)
                local ty = math.floor(py / 32)
                print("[COLLECT] Item " .. id .. " at tile=" .. tx .. "," .. ty)
                -- Move and wait 4s (enough time to walk ~8 tiles)
                pcall(function() bot:moveTo(px, py) end)
                sleep(4000)
                pcall(function() bot:collect(obj.oid) end)
                pcall(function() bot:collect(px, py) end)
                pcall(function() bot:collect(tx, ty) end)
                pcall(function() bot:punch(px, py) end)
                pcall(function() bot:punch(tx, ty) end)
                sleep(300)
            end
        end
    end
end

local function complete_deposit(bot, dep, totalDL)
    if totalDL <= 0 then
        print("[DEPOSIT] Nothing received - cancelling " .. dep.world)
        api_post("/bot/cancel-deposit", "worldName=" .. dep.world)
        bot:leaveWorld()
        sleep(1000)
        bot:warp("EXIT")
        claimed_worlds[dep.world] = nil
        activeDeposit = nil
        return
    end
    local done_res = api_post("/bot/deposit-complete",
        "worldName=" .. dep.world .. "&amountDl=" .. tostring(totalDL))
    if done_res and done_res:find('"ok":true') then
        print("[DEPOSIT] Credited " .. totalDL .. " DL to " .. dep.growId)
        bot:say(dep.growId .. " Deposit received!")
    else
        print("[DEPOSIT] deposit-complete failed: " .. tostring(done_res))
        bot:say(dep.growId .. " Something went wrong - contact support.")
    end
    claimed_worlds[dep.world] = nil
    activeDeposit = nil
end

local function check_active_deposit(bot)
    if not activeDeposit then return end
    local dep = activeDeposit
    local now = os.time()

    -- Expire
    if dep.expiresAt > 0 and now >= dep.expiresAt then
        print("[DEPOSIT] Timer expired for " .. dep.world)
        complete_deposit(bot, dep, dep.totalDL or 0)
        return
    end

    -- Walk over any dropped items
    collect_dropped_items(bot)

    -- Check if inventory increased since last check
    local curBGL, curDL, curWL = inv_snapshot(bot)
    local gainBGL = curBGL - dep.prevBGL
    local gainDL  = curDL  - dep.prevDL
    local gainWL  = curWL  - dep.prevWL

    if gainBGL > 0 or gainDL > 0 or gainWL > 0 then
        local gained = (gainBGL * 100) + gainDL + (gainWL / 100)
        dep.totalDL = (dep.totalDL or 0) + gained
        dep.prevBGL = curBGL
        dep.prevDL  = curDL
        dep.prevWL  = curWL
        dep.lastGainTime = now
        print("[DEPOSIT] Picked up " .. gained .. " DL (total: " .. dep.totalDL .. " DL)")
    end

    -- If items were received and nothing new for 5 seconds, complete
    if (dep.totalDL or 0) > 0 and dep.lastGainTime and now - dep.lastGainTime >= 5 then
        print("[DEPOSIT] No new drops for 5s - completing")
        complete_deposit(bot, dep, dep.totalDL)
    end
end

local function poll_deposits(bot)
    if activeDeposit then return end

    local res = api_get("/bot/pending-deposits", "format=text")
    if not res or res == "" then return end

    for line in res:gmatch("[^\n]+") do
        local world, growId, userId, expiresAtStr = line:match("^([^|]+)|([^|]*)|([^|]+)|([^|]*)$")
        if world and not claimed_worlds[world] then
            local expiresAt = tonumber(expiresAtStr) or 0
            print("[DEPOSIT] New session - world: " .. world .. " player: " .. tostring(growId))

            claimed_worlds[world] = true
            print("[WARP] Leaving current world...")
            bot:leaveWorld()
            sleep(2000)
            print("[WARP] Entering " .. world)
            bot:warp(world)
            sleep(7000)

            local claim_res = api_post("/bot/claim-deposit",
                "worldName=" .. world .. "&botGrowId=" .. BOT_GROW_ID)
            print("[CLAIM] response: " .. tostring(claim_res))
            if not claim_res or not claim_res:find('"ok":true') then
                print("[DEPOSIT] Claim failed: " .. tostring(claim_res))
                claimed_worlds[world] = nil
                return
            end

            print("[SAY] Telling " .. tostring(growId) .. " to drop")
            bot:say(tostring(growId) .. " Drop")
            sleep(500)

            local prevBGL, prevDL, prevWL = inv_snapshot(bot)
            activeDeposit = {
                world        = world,
                growId       = tostring(growId),
                expiresAt    = os.time() + DEPOSIT_DURATION,
                prevBGL      = prevBGL,
                prevDL       = prevDL,
                prevWL       = prevWL,
                totalDL      = 0,
                lastGainTime = 0,
            }
            print("[DEPOSIT] Watching for dropped items in " .. world)
            return
        end
    end
end

local function poll_withdrawals(bot)
    local res = api_get("/bot/pending-withdrawals", "format=text")
    if not res or res == "" then return end
    for line in res:gmatch("[^\n]+") do
        local tx_id, grow_id, amount_str = line:match("^([^|]+)|([^|]*)|([^|]+)$")
        if tx_id and not processing_wd[tx_id] then
            processing_wd[tx_id] = true
            local amount = tonumber(amount_str) or 0
            print("[WITHDRAW] " .. tostring(amount) .. " DL to " .. tostring(grow_id))
            local done_res = api_post("/bot/withdraw-complete", "transactionId=" .. tx_id)
            if done_res and done_res:find('"ok":true') then
                print("[WITHDRAW] Complete txId=" .. tx_id)
            end
            processing_wd[tx_id] = nil
        end
    end
end

print("BetTopia bot started!")

-- Discover which world-change methods exist on the bot object
do
    local bot = getBot(BOT_GROW_ID)
    if bot then
        local methods = {"warp","goToWorld","enterWorld","goWorld","changeWorld",
                         "setWorld","joinWorld","reconnect","leaveWorld","connect",
                         "sendPacket","sendPacketRaw","sendRaw"}
        for _, fn in ipairs(methods) do
            local t = type(bot[fn])
            if t ~= "nil" then
                print("[API] bot." .. fn .. " = " .. t)
            end
        end
    end
end

while true do
    local bot = getBot(BOT_GROW_ID)
    if bot then
        check_active_deposit(bot)
        if not activeDeposit then
            poll_deposits(bot)
            poll_withdrawals(bot)
        end
    else
        print("[ERROR] Bot not found: " .. BOT_GROW_ID)
    end
    sleep(500)
end
