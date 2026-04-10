-- BetTopia Deposit Bot
-- Lucifer v2.83 p2
-- Drop-based deposit: player drops items in the world, bot collects them.
-- No trade acceptance needed.

local WEBSITE_URL = "https://case-topia.replit.app"
local BOT_SECRET  = "0d68e6d0b7388733c797bfbe76ad3e5e2f3917de52365871ac1f3d7685f8037e"
local BOT_GROW_ID = "zPlaysGT"

-- Growtopia item IDs
local ITEM_BGL = 4532 -- Blue Gem Lock  (100 DL each)
local ITEM_DL  = 1796 -- Diamond Lock   (1 DL each)
local ITEM_WL  = 242  -- World Lock     (0.01 DL each)

local claimed_worlds = {}
local processing_wd  = {}

-- Active deposit: nil when idle
-- Fields: world, growId, expiresAt, prevBGL, prevDL, prevWL, totalDL, lastGainTime
local activeDeposit = nil

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
        local h = io.popen('curl -s -X POST "' .. url .. '"')
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

-- Walk to and collect any DL/BGL/WL objects in the current world
local function collect_items(bot)
    local world = bot:getWorld()
    local objs = world:getObjects()
    local found = false
    for i = 1, objs:size() do
        local ok, obj = pcall(function() return objs:get(i) end)
        if ok and obj then
            local id = obj.id
            if id == ITEM_BGL or id == ITEM_DL or id == ITEM_WL then
                found = true
                print("[COLLECT] Item " .. id .. " at " .. obj.x .. "," .. obj.y)
                bot:moveTo(obj.x, obj.y)
                sleep(800)
                -- Try explicit collect calls in case moveTo isn't enough
                pcall(function() bot:collect(obj.x, obj.y) end)
                pcall(function() bot:collect(obj.oid) end)
                pcall(function() bot:collect() end)
            end
        end
    end
    return found
end

local function complete_deposit()
    local dep = activeDeposit
    if dep.totalDL <= 0 then
        print("[DEPOSIT] Nothing received in " .. dep.world .. " - cancelling")
        api_post("/bot/cancel-deposit", "worldName=" .. dep.world)
        bot:warp("EXIT")
        claimed_worlds[dep.world] = nil
        activeDeposit = nil
        return
    end

    local done_res = api_post("/bot/deposit-complete",
        "worldName=" .. dep.world .. "&amountDl=" .. tostring(dep.totalDL))
    if done_res and done_res:find('"ok":true') then
        print("[DEPOSIT] Credited " .. dep.totalDL .. " DL")
        bot:say("@" .. dep.growId .. " Deposit received! " .. tostring(dep.totalDL) .. " DL added to your balance.")
    else
        print("[DEPOSIT] deposit-complete failed: " .. tostring(done_res))
        bot:say("@" .. dep.growId .. " Something went wrong - contact support.")
    end
    claimed_worlds[dep.world] = nil
    activeDeposit = nil
end

local function check_active_deposit(bot)
    if not activeDeposit then return end

    local now = os.time()

    -- Expired: complete with whatever was received
    if activeDeposit.expiresAt > 0 and now >= activeDeposit.expiresAt then
        print("[DEPOSIT] Timer expired for " .. activeDeposit.world)
        complete_deposit()
        return
    end

    -- Try to collect any dropped items
    collect_items(bot)

    -- Check inventory for gains since last check
    local curBGL, curDL, curWL = inv_snapshot(bot)
    local gainBGL = curBGL - activeDeposit.prevBGL
    local gainDL  = curDL  - activeDeposit.prevDL
    local gainWL  = curWL  - activeDeposit.prevWL

    if gainBGL > 0 or gainDL > 0 or gainWL > 0 then
        local gained = (gainBGL * 100) + gainDL + (gainWL / 100)
        activeDeposit.totalDL = activeDeposit.totalDL + gained
        activeDeposit.lastGainTime = now
        -- Update baseline for next check
        activeDeposit.prevBGL = curBGL
        activeDeposit.prevDL  = curDL
        activeDeposit.prevWL  = curWL
        print("[DEPOSIT] Received " .. gained .. " DL (total: " .. activeDeposit.totalDL .. " DL)")
        bot:say("@" .. activeDeposit.growId .. " Got " .. gained .. " DL! Drop more or wait to finish.")
    end

    -- If items were received and no new drops for 5 seconds, complete
    if activeDeposit.totalDL > 0 and activeDeposit.lastGainTime > 0
        and now - activeDeposit.lastGainTime >= 5 then
        print("[DEPOSIT] No new items for 5s - completing deposit")
        complete_deposit()
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

            bot:say("@" .. tostring(growId) .. " Hi! DROP your Diamond Locks / BGLs here to deposit. Do NOT trade!")

            local prevBGL, prevDL, prevWL = inv_snapshot(bot)
            activeDeposit = {
                world       = world,
                growId      = tostring(growId),
                expiresAt   = expiresAt,
                prevBGL     = prevBGL,
                prevDL      = prevDL,
                prevWL      = prevWL,
                totalDL     = 0,
                lastGainTime = 0,
            }
            print("[DEPOSIT] Watching world " .. world .. " for dropped items")
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
            -- TODO: deliver items in-game
            local done_res = api_post("/bot/withdraw-complete", "transactionId=" .. tx_id)
            if done_res and done_res:find('"ok":true') then
                print("[WITHDRAW] Complete txId=" .. tx_id)
            end
            processing_wd[tx_id] = nil
        end
    end
end

local bot = getBot(BOT_GROW_ID)
print("BetTopia bot started! Bot: " .. tostring(bot))

while true do
    check_active_deposit(bot)
    if not activeDeposit then
        poll_deposits(bot)
        poll_withdrawals(bot)
    end
    sleep(500)
end
