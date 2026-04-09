-- BetTopia Deposit & Withdrawal Bot
-- Lucifer v2.83 p2
-- Uses curl via io.popen; no JSON library required (text format API)

local WEBSITE_URL = "https://case-topia.replit.app"
local BOT_SECRET  = "0d68e6d0b7388733c797bfbe76ad3e5e2f3917de52365871ac1f3d7685f8037e"
local BOT_GROW_ID = "zPlaysGT"

local ITEM_VALUES = {
    ["World Lock"]    = 0.01,
    ["Diamond Lock"]  = 1,
    ["Blue Gem Lock"] = 100,
    ["Dragon Lock"]   = 500,
}

local claimed_worlds = {}
local processing_wd  = {}

local function sleep(ms)
    local t = os.clock()
    while os.clock() - t < ms / 1000 do end
end

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

local function trade_value(items)
    local total = 0
    for _, item in ipairs(items or {}) do
        local val = ITEM_VALUES[item.name]
        if val then
            total = total + val * (item.count or item.quantity or 1)
        else
            print("[WARN] Unknown item: " .. tostring(item.name))
        end
    end
    return total
end

local function poll_deposits()
    local res = api_get("/bot/pending-deposits", "format=text")
    if not res or res == "" then return end
    for line in res:gmatch("[^\n]+") do
        -- format: worldName|growId|userId
        local world, growId, userId = line:match("^([^|]+)|([^|]*)|([^|]+)$")
        if world and not claimed_worlds[world] then
            print("[DEPOSIT] New session - world: " .. world .. " player: " .. tostring(growId))
            Lucifer.warp(world)
            sleep(3000)
            local claim_res = api_post("/bot/claim-deposit",
                "worldName=" .. world .. "&botGrowId=" .. BOT_GROW_ID)
            if claim_res and claim_res:find('"ok":true') then
                claimed_worlds[world] = true
                print("[DEPOSIT] Claimed " .. world)
                Lucifer.say("@" .. tostring(growId) .. " Hi! Trade me your DLs here to deposit.")
            else
                print("[DEPOSIT] Claim failed: " .. tostring(claim_res))
            end
        end
    end
end

local function poll_withdrawals()
    local res = api_get("/bot/pending-withdrawals", "format=text")
    if not res or res == "" then return end
    for line in res:gmatch("[^\n]+") do
        -- format: id|growId|amountDl
        local tx_id, grow_id, amount_str = line:match("^([^|]+)|([^|]*)|([^|]+)$")
        if tx_id and not processing_wd[tx_id] then
            processing_wd[tx_id] = true
            local amount = tonumber(amount_str) or 0
            print("[WITHDRAW] " .. tostring(amount) .. " DL to " .. tostring(grow_id))
            -- TODO: deliver items in-game
            local done_res = api_post("/bot/withdraw-complete",
                "transactionId=" .. tx_id)
            if done_res and done_res:find('"ok":true') then
                print("[WITHDRAW] Complete txId=" .. tx_id)
            end
            processing_wd[tx_id] = nil
        end
    end
end

function onTradeAccepted(player_name, items)
    local world  = getWorld()
    local amount = trade_value(items)
    if amount <= 0 then
        print("[TRADE] No recognized items from " .. tostring(player_name))
        return
    end
    print("[TRADE] " .. tostring(amount) .. " DL from " .. tostring(player_name) .. " in " .. tostring(world))
    local res = api_post("/bot/deposit-complete",
        "worldName=" .. world .. "&amountDl=" .. tostring(amount))
    if res and res:find('"ok":true') then
        print("[TRADE] Credited " .. tostring(amount) .. " DL")
        Lucifer.say("@" .. player_name .. " Deposit received! " .. tostring(amount) .. " DL added to your balance.")
        claimed_worlds[world] = nil
    else
        print("[TRADE] deposit-complete failed: " .. tostring(res))
        Lucifer.say("@" .. player_name .. " Something went wrong - contact support.")
    end
end

print("BetTopia bot started!")
while true do
    poll_deposits()
    sleep(1000)
    poll_withdrawals()
    sleep(4000)
end
