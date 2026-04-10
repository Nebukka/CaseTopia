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
                local px = obj.x
                local py = obj.y
                -- Tile coords (GT tiles = 32px each)
                local tx = math.floor(px / 32)
                local ty = math.floor(py / 32)
                print("[COLLECT] Item " .. id .. " px=" .. px .. "," .. py .. " tile=" .. tx .. "," .. ty)
                -- Move to item and wait long enough to walk up to 8 tiles
                pcall(function() bot:moveTo(tx, ty) end)
                sleep(1500)
                -- Try every known collection method
                local rc = pcall(function() bot:collect(obj.oid) end)
                if not rc then pcall(function() bot:collect(px, py) end) end
                if not rc then pcall(function() bot:collect(tx, ty) end) end
                pcall(function() bot:punch(tx, ty) end)
                pcall(function() bot:punch(px, py) end)
                sleep(300)
            end
        end
    end
end

local function complete_deposit(bot, dep, totalDL)
    if totalDL <= 0 then
        print("[DEPOSIT] Nothing received - cancelling " .. dep.world)
        api_post("/bot/cancel-deposit", "worldName=" .. dep.world)
        bot:warp("EXIT")
        claimed_worlds[dep.world] = nil
        activeDeposit = nil
        return
    end
    local done_res = api_post("/bot/deposit-complete",
        "worldName=" .. dep.world .. "&amountDl=" .. tostring(totalDL))
    if done_res and done_res:find('"ok":true') then
        print("[DEPOSIT] Credited " .. totalDL .. " DL to " .. dep.growId)
        bot:say("@" .. dep.growId .. " Deposit received! " .. tostring(totalDL) .. " DL added to your balance.")
    else
        print("[DEPOSIT] deposit-complete failed: " .. tostring(done_res))
        bot:say("@" .. dep.growId .. " Something went wrong - contact support.")
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
        bot:say("@" .. dep.growId .. " Got " .. gained .. " DL! Drop more or wait 5s to finish.")
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
            bot:warp(world)
            sleep(3000)

            local claim_res = api_post("/bot/claim-deposit",
                "worldName=" .. world .. "&botGrowId=" .. BOT_GROW_ID)
            if not claim_res or not claim_res:find('"ok":true') then
                print("[DEPOSIT] Claim failed: " .. tostring(claim_res))
                claimed_worlds[world] = nil
                return
            end

            bot:say("@" .. tostring(growId) .. " Hi! DROP your Diamond Locks / BGLs on the ground to deposit. I will pick them up!")

            local prevBGL, prevDL, prevWL = inv_snapshot(bot)
            activeDeposit = {
                world        = world,
                growId       = tostring(growId),
                expiresAt    = expiresAt,
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

local bot = getBot(BOT_GROW_ID)
print("BetTopia bot started!")

while true do
    check_active_deposit(bot)
    if not activeDeposit then
        poll_deposits(bot)
        poll_withdrawals(bot)
    end
    sleep(500)
end
