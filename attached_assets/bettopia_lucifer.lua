-- BetTopia Deposit & Withdrawal Bot
-- Lucifer v2.83 p2
-- Deposit detection via inventory polling (getItemCount)
-- No trade events needed; works with curl via io.popen

local WEBSITE_URL = "https://case-topia.replit.app"
local BOT_SECRET  = "0d68e6d0b7388733c797bfbe76ad3e5e2f3917de52365871ac1f3d7685f8037e"
local BOT_GROW_ID = "zPlaysGT"

-- Growtopia item IDs
local ITEM_BGL = 4532 -- Blue Gem Lock  (100 DL each)
local ITEM_DL  = 1796 -- Diamond Lock   (1 DL each)
local ITEM_WL  = 242  -- World Lock     (0.01 DL each)

-- Deposits claimed this session (worldName -> true)
local claimed_worlds = {}
-- Withdrawals being processed this session (txId -> true)
local processing_wd  = {}

-- GET request, returns raw response string or nil
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

-- POST request using query params, returns response string or nil
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

-- Snapshot current BGL, DL, and WL counts
local function inv_snapshot(bot)
    local inv = bot:getInventory()
    return inv:getItemCount(ITEM_BGL), inv:getItemCount(ITEM_DL), inv:getItemCount(ITEM_WL)
end

-- Watch inventory for up to timeoutSecs seconds.
-- Returns gained DL amount (BGL*100 + DL + WL/100), or 0 on timeout.
local function watch_inventory(bot, timeoutSecs)
    local prevBGL, prevDL, prevWL = inv_snapshot(bot)
    print("[INV] Before trade - BGL:" .. prevBGL .. " DL:" .. prevDL .. " WL:" .. prevWL)
    local elapsed = 0
    while elapsed < timeoutSecs do
        sleep(2000)
        elapsed = elapsed + 2
        local curBGL, curDL, curWL = inv_snapshot(bot)
        local gainBGL = curBGL - prevBGL
        local gainDL  = curDL  - prevDL
        local gainWL  = curWL  - prevWL
        if gainBGL > 0 or gainDL > 0 or gainWL > 0 then
            -- Convert: 1 BGL = 100 DL, 100 WL = 1 DL
            local totalDL = (gainBGL * 100) + gainDL + (gainWL / 100)
            print("[INV] Trade detected! +" .. gainBGL .. " BGL, +" .. gainDL .. " DL, +" .. gainWL .. " WL = " .. totalDL .. " DL total")
            return totalDL
        end
    end
    return 0
end

local function handle_deposit(bot, world, growId, userId)
    claimed_worlds[world] = true
    bot:warp(world)
    sleep(3000)

    -- Claim the session so it leaves the pending queue
    local claim_res = api_post("/bot/claim-deposit",
        "worldName=" .. world .. "&botGrowId=" .. BOT_GROW_ID)
    if not claim_res or not claim_res:find('"ok":true') then
        print("[DEPOSIT] Claim failed for " .. world .. ": " .. tostring(claim_res))
        claimed_worlds[world] = nil
        return
    end
    print("[DEPOSIT] Claimed " .. world)
    bot:say("@" .. tostring(growId) .. " Hi! Trade me your Diamond Locks to deposit.")

    -- Wait for the player to trade (up to 2 minutes = 120 seconds)
    local amount = watch_inventory(bot, 120)

    if amount <= 0 then
        print("[DEPOSIT] Timed out waiting for trade in " .. world .. " - cancelling")
        api_post("/bot/cancel-deposit", "worldName=" .. world)
        bot:warp("EXIT")
        claimed_worlds[world] = nil
        return
    end

    -- Complete the deposit
    local done_res = api_post("/bot/deposit-complete",
        "worldName=" .. world .. "&amountDl=" .. tostring(amount))
    if done_res and done_res:find('"ok":true') then
        print("[DEPOSIT] Credited " .. amount .. " DL for world " .. world)
        bot:say("@" .. tostring(growId) .. " Deposit received! " .. tostring(amount) .. " DL added to your balance.")
    else
        print("[DEPOSIT] deposit-complete failed: " .. tostring(done_res))
        bot:say("@" .. tostring(growId) .. " Something went wrong - contact support.")
    end

    claimed_worlds[world] = nil
end

local function poll_deposits(bot)
    local res = api_get("/bot/pending-deposits", "format=text")
    if not res or res == "" then return end
    for line in res:gmatch("[^\n]+") do
        -- format: worldName|growId|userId
        local world, growId, userId = line:match("^([^|]+)|([^|]*)|([^|]+)$")
        if world and not claimed_worlds[world] then
            print("[DEPOSIT] New session - world: " .. world .. " player: " .. tostring(growId))
            handle_deposit(bot, world, growId, userId)
            -- handle_deposit is blocking (waits for trade), so only one at a time
            return
        end
    end
end

local function poll_withdrawals(bot)
    local res = api_get("/bot/pending-withdrawals", "format=text")
    if not res or res == "" then return end
    for line in res:gmatch("[^\n]+") do
        -- format: id|growId|amountDl
        local tx_id, grow_id, amount_str = line:match("^([^|]+)|([^|]*)|([^|]+)$")
        if tx_id and not processing_wd[tx_id] then
            processing_wd[tx_id] = true
            local amount = tonumber(amount_str) or 0
            print("[WITHDRAW] " .. tostring(amount) .. " DL to " .. tostring(grow_id))
            -- TODO: deliver items in-game (trade TO the player)
            local done_res = api_post("/bot/withdraw-complete",
                "transactionId=" .. tx_id)
            if done_res and done_res:find('"ok":true') then
                print("[WITHDRAW] Complete txId=" .. tx_id)
            end
            processing_wd[tx_id] = nil
        end
    end
end

-- Main loop
local bot = getBot(BOT_GROW_ID)
print("BetTopia bot started! Bot: " .. tostring(bot))

while true do
    poll_deposits(bot)
    sleep(1000)
    poll_withdrawals(bot)
    sleep(4000)
end
