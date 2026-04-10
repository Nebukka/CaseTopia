-- BetTopia Deposit Bot
-- Lucifer v2.83 p2
-- Bot initiates /trade (growId) when the depositor enters the world.
-- Inventory polling detects when trade completes.

local WEBSITE_URL = "https://case-topia.replit.app"
local BOT_SECRET  = "0d68e6d0b7388733c797bfbe76ad3e5e2f3917de52365871ac1f3d7685f8037e"
local BOT_GROW_ID = "zPlaysGT"

-- Growtopia item IDs
local ITEM_BGL = 4532 -- Blue Gem Lock  (100 DL each)
local ITEM_DL  = 1796 -- Diamond Lock   (1 DL each)
local ITEM_WL  = 242  -- World Lock     (0.01 DL each)

local claimed_worlds = {}
local processing_wd  = {}

-- Active deposit session
-- Fields: world, growId, expiresAt, prevBGL, prevDL, prevWL, lastTradeAttempt
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

-- Check if a player with the given growId is currently in the world
local function player_in_world(bot, growId)
    local world = bot:getWorld()
    -- Try getPlayer by name first
    local ok, p = pcall(function() return world:getPlayer(growId) end)
    if ok and p ~= nil then return true end
    -- Fallback: scan getPlayers list
    local ok2, players = pcall(function() return world:getPlayers() end)
    if not ok2 then return false end
    -- players is userdata; try iterating like objects
    local ok3, sz = pcall(function() return players:size() end)
    if ok3 and sz then
        for i = 1, sz do
            local ok4, pl = pcall(function() return players:get(i) end)
            if ok4 and pl then
                local ok5, nm = pcall(function() return pl.name end)
                if ok5 and nm and nm:lower() == growId:lower() then
                    return true
                end
            end
        end
    end
    return false
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
        print("[DEPOSIT] Credited " .. totalDL .. " DL")
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

    -- Check expiry
    if dep.expiresAt > 0 and now >= dep.expiresAt then
        print("[DEPOSIT] Timer expired for " .. dep.world)
        complete_deposit(bot, dep, dep.totalDL or 0)
        return
    end

    -- Check inventory for trade completion
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
        print("[DEPOSIT] Trade complete! +" .. gainBGL .. " BGL +" .. gainDL .. " DL +" .. gainWL .. " WL = " .. gained .. " DL")
        complete_deposit(bot, dep, dep.totalDL)
        return
    end

    -- If player is in the world, retry /trade every 10 seconds
    if player_in_world(bot, dep.growId) then
        if now - (dep.lastTradeAttempt or 0) >= 10 then
            dep.lastTradeAttempt = now
            print("[DEPOSIT] Player found - sending /trade " .. dep.growId)
            bot:say("/trade " .. dep.growId)
        end
    else
        -- Player not here yet, remind them every 30 seconds
        if now - (dep.lastRemind or 0) >= 30 then
            dep.lastRemind = now
            print("[DEPOSIT] Waiting for " .. dep.growId .. " to join " .. dep.world)
        end
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

            bot:say("@" .. tostring(growId) .. " Hi! I'll send you a trade request shortly. Accept it and add your DLs!")

            local prevBGL, prevDL, prevWL = inv_snapshot(bot)
            activeDeposit = {
                world            = world,
                growId           = tostring(growId),
                expiresAt        = expiresAt,
                prevBGL          = prevBGL,
                prevDL           = prevDL,
                prevWL           = prevWL,
                totalDL          = 0,
                lastTradeAttempt = 0,
                lastRemind       = os.time(),
            }
            print("[DEPOSIT] Watching world " .. world .. " for " .. growId)
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
