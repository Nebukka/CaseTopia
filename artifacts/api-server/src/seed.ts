import { db, casesTable, usersTable } from "@workspace/db";
import { eq, count, and } from "drizzle-orm";
import { logger } from "./lib/logger";

const OFFICIAL_CASES = [
  {
    name: "Lucky Day",
    imageUrl: "chest:#7C3AED|/api/assets/l_drag_1775619570342.webp",
    price: 0.1808,
    category: "community",
    isCommunity: false,
    createdById: null,
    createdByName: null,
    items: [
      { id: "dirt_block", name: "Dirt Block", color: "#795548", value: 0.01, chance: 99.988, rarity: "common", imageUrl: "/api/assets/ItemSprites_1775515530120.webp" },
      { id: "toxic_waste", name: "Toxic Waste", color: "#76ff03", value: 800, chance: 0.01, rarity: "legendary", imageUrl: "/api/assets/toxic_waste_1775542150980.webp" },
      { id: "dragon_of_legend", name: "Dragon Of Legend", color: "#9c27b0", value: 3000, chance: 0.001, rarity: "legendary", imageUrl: "/api/assets/l_drag_1775619570342.webp" },
      { id: "raymans_fist", name: "Rayman's Fist", color: "#e0e0e0", value: 5000, chance: 0.001, rarity: "legendary", imageUrl: "/api/assets/raymans_fist_1775521703679.webp" },
    ],
  },
  {
    name: "Super Summer",
    imageUrl: "chest:#DC2626|/api/assets/neptune's_tridemt_1775542674170.webp",
    price: 334.8805,
    category: "community",
    isCommunity: false,
    createdById: 1,
    createdByName: "Cylax",
    items: [
      { id: "atomic_fireball", name: "Atomic Fireball", color: "#ff3d00", value: 0.7, chance: 66.1, rarity: "common", imageUrl: "/api/assets/atomic_firebal_1775620063492.webp" },
      { id: "sandcastle", name: "Sandcastle", color: "#fbc02d", value: 120, chance: 8, rarity: "epic", imageUrl: "/api/assets/sandcastle_1775619849193.webp" },
      { id: "phoenix_mantle", name: "Phoenix Mantle", color: "#ef6c00", value: 250, chance: 5, rarity: "epic", imageUrl: "/api/assets/p_mantle_1775542738537.webp" },
      { id: "phoenix_pacifier", name: "Phoenix Pacifier", color: "#ff6f00", value: 400, chance: 3.5, rarity: "mythic", imageUrl: "/api/assets/phoenix_pacifier_1775619864774.webp" },
      { id: "phoenix_sword", name: "Phoenix Sword", color: "#ef5350", value: 550, chance: 2.75, rarity: "mythic", imageUrl: "/api/assets/p_sword_1775619879406.webp" },
      { id: "phoenix_feet", name: "Phoenix Feet", color: "#ff7043", value: 600, chance: 2.25, rarity: "mythic", imageUrl: "/api/assets/phoenix_feet_1775542710878.webp" },
      { id: "neptunes_trident", name: "Neptune's Trident", color: "#00acc1", value: 60000, chance: 0.4, rarity: "legendary", imageUrl: "/api/assets/neptune's_tridemt_1775542674170.webp" },
      { id: "occeans_eternal_wake", name: "Occean's Eternal Wake", color: "#00bcd4", value: 80, chance: 12, rarity: "epic", imageUrl: "/api/assets/occean's_eternal_wake_1775619718793.webp" },
    ],
  },
  {
    name: "Holy Aura",
    imageUrl: "chest:#4338CA|/api/assets/ultraviolet_aura_1775540839583.webp",
    price: 54.6586,
    category: "official",
    isCommunity: false,
    createdById: 1,
    createdByName: "Cylax",
    items: [
      { id: "world_lock",           name: "World Lock",              color: "#f9a825", value: 0.01,  chance: 40.75, rarity: "uncommon", imageUrl: "/api/assets/world_lock_1775516155016.webp" },
      { id: "northern_lights_aura", name: "Northern Lights Aura",    color: "#00e5ff", value: 8,     chance: 15,    rarity: "rare",     imageUrl: "/api/assets/northern_lights_1775540546841.webp" },
      { id: "golden_aura",          name: "Golden Aura",             color: "#ffd600", value: 10,    chance: 10,    rarity: "epic",     imageUrl: "/api/assets/Golden_Aura_1775540722047.webp" },
      { id: "blue_aura",            name: "Blue Aura",               color: "#1e88e5", value: 10,    chance: 10,    rarity: "epic",     imageUrl: "/api/assets/blue_aura_1775540734935.webp" },
      { id: "black_aura",           name: "Black Aura",              color: "#424242", value: 12,    chance: 10,    rarity: "epic",     imageUrl: "/api/assets/black_aura_1775540755128.webp" },
      { id: "galaxy_aura",          name: "Galaxy Aura",             color: "#7c4dff", value: 50,    chance: 5,     rarity: "epic",     imageUrl: "/api/assets/galaxy_aura_1775540770966.webp" },
      { id: "infinity_aura",        name: "Infinity Aura",           color: "#00bcd4", value: 220,   chance: 3,     rarity: "mythic",   imageUrl: "/api/assets/infinity_aura_1775540786448.webp" },
      { id: "money_aura",           name: "Money Aura",              color: "#43a047", value: 230,   chance: 2.5,   rarity: "mythic",   imageUrl: "/api/assets/money_aura_1775540797256.webp" },
      { id: "astral_aura_dragon",   name: "Astral Aura - Dragon",    color: "#e53935", value: 700,   chance: 1.5,   rarity: "mythic",   imageUrl: "/api/assets/astral_-_dragon_1775540827419.webp" },
      { id: "astral_aura_black_cat",name: "Astral Aura - Black Cat", color: "#5c6bc0", value: 850,   chance: 1.25,  rarity: "mythic",   imageUrl: "/api/assets/astral_black_cat_1775540812119.webp" },
      { id: "ultraviolet_aura",     name: "Ultraviolet Aura",        color: "#9c27b0", value: 1100,  chance: 1,     rarity: "legendary",imageUrl: "/api/assets/ultraviolet_aura_1775540839583.webp" },
    ],
  },
  {
    name: "Sword Fight",
    imageUrl: "chest:#EAB308|/api/assets/l_katana_1775671965788.webp",
    price: 49.7819,
    category: "official",
    isCommunity: false,
    createdById: 1,
    createdByName: "Cylax",
    items: [
      { id: "golden_sword",       name: "Golden Sword",            color: "#EAB308", value: 0.1,   chance: 94.95, rarity: "common",   imageUrl: "/api/assets/growtopia_golden_sword_1775674603345.webp" },
      { id: "black_uv_sword",     name: "Black Ultraviolet Sword", color: "#7c3aed", value: 400,   chance: 2,     rarity: "mythic",   imageUrl: "/api/assets/black_uv_sword_1775673359330.webp" },
      { id: "phoenix_sword",      name: "Phoenix Sword",           color: "#ef5350", value: 550,   chance: 1.5,   rarity: "mythic",   imageUrl: "/api/assets/p_sword_1775619879406.webp" },
      { id: "ultraviolet_sword",  name: "Ultraviolet Sword",       color: "#8b5cf6", value: 900,   chance: 0.8,   rarity: "legendary",imageUrl: "/api/assets/uv_sword_1775672083917.webp" },
      { id: "magic_infused_blade",name: "Magic Infused Blade",     color: "#22d3ee", value: 2500,  chance: 0.4,   rarity: "legendary",imageUrl: "/api/assets/magic_inf_1775672230451.webp" },
      { id: "chats_moeru_blade",  name: "chat's Moeru Blade",      color: "#c026d3", value: 3500,  chance: 0.25,  rarity: "legendary",imageUrl: "/api/assets/chat_moeru_1775672201216.webp" },
      { id: "legendary_katana",   name: "Legendary Katana",        color: "#fbbf24", value: 4500,  chance: 0.1,   rarity: "legendary",imageUrl: "/api/assets/l_katana_1775671965788.webp" },
    ],
  },
  {
    name: "Starter Pack",
    imageUrl: "chest:#7B4A1E|/api/assets/Chimera_1775542535003.webp",
    price: 0.9809,
    category: "community",
    isCommunity: false,
    createdById: 1,
    createdByName: "Cylax",
    items: [
      { id: "dirt_block", name: "Dirt Block", color: "#795548", value: 0.01, chance: 40, rarity: "uncommon", imageUrl: "/api/assets/ItemSprites_1775515530120.webp" },
      { id: "dragon_hand", name: "Dragon Hand", color: "#f44336", value: 0.5, chance: 20, rarity: "rare", imageUrl: "/api/assets/dragon_hand_1775515732814.webp" },
      { id: "crystal_block", name: "Crystal Block", color: "#80deea", value: 1, chance: 10, rarity: "epic", imageUrl: "/api/assets/crystal_block_1775540410174.webp" },
      { id: "heartbow", name: "Heartbow", color: "#ec407a", value: 1.2, chance: 9, rarity: "epic", imageUrl: "/api/assets/heartbow_1775540975265.webp" },
      { id: "white_crystal", name: "White Crystal", color: "#eceff1", value: 1.5, chance: 7, rarity: "epic", imageUrl: "/api/assets/white_cryst_1775540530922.webp" },
      { id: "harvester", name: "Harvester", color: "#ef5350", value: 2.5, chance: 5, rarity: "epic", imageUrl: "/api/assets/harvester_1775540959608.webp" },
      { id: "silver_idol", name: "Silver Idol", color: "#b0bec5", value: 3, chance: 4, rarity: "mythic", imageUrl: "/api/assets/silver_idol_1775540512878.webp" },
      { id: "floating_leaf", name: "Floating Leaf", color: "#8bc34a", value: 4, chance: 3, rarity: "mythic", imageUrl: "/api/assets/floating_leaf_1775540948636.webp" },
      { id: "chimera_wings", name: "Chimera Wings", color: "#1e88e5", value: 7, chance: 2, rarity: "mythic", imageUrl: "/api/assets/Chimera_1775542535003.webp" },
    ],
  },
] as const;

async function getSummerCaseItems(superSummerId: number) {
  return [
    { id: "sand_block", name: "Sand", color: "#f9a825", value: 0.01, chance: 24.8, rarity: "uncommon", imageUrl: "/api/assets/sand_block_1775619832644.webp" },
    { id: "growmoji_fireworks", name: "Growmoji Fireworks", color: "#e53935", value: 0.3, chance: 19, rarity: "rare", imageUrl: "/api/assets/growmoji_fireworks_1775620050288.webp" },
    { id: "summer_surprise", name: "Summer Surprise", color: "#1565c0", value: 0.5, chance: 15, rarity: "rare", imageUrl: "/api/assets/summer_surprise_1775620006977.webp" },
    { id: "atomic_fireball", name: "Atomic Fireball", color: "#ff3d00", value: 0.7, chance: 10, rarity: "epic", imageUrl: "/api/assets/atomic_firebal_1775620063492.webp" },
    { id: "summer_artifact_chest", name: "Summer Artifact Chest", color: "#ff7043", value: 0.9, chance: 10, rarity: "epic", imageUrl: "/api/assets/summer_artifact_chest_1775619818188.webp" },
    { id: "super_summer_surprise", name: "Super Summer Surprise", color: "#f9a825", value: 3.5, chance: 6, rarity: "epic", imageUrl: "/api/assets/super_summer_surprise_1775620035680.webp" },
    { id: "super_firework", name: "Super Firework", color: "#e53935", value: 4, chance: 5, rarity: "epic", imageUrl: "/api/assets/super_firework_1775620023666.webp" },
    { id: "occeans_eternal_wake", name: "Occean's Eternal Wake", color: "#00bcd4", value: 80, chance: 2, rarity: "mythic", imageUrl: "/api/assets/occean's_eternal_wake_1775619718793.webp" },
    { id: "sandcastle", name: "Sandcastle", color: "#fbc02d", value: 120, chance: 1, rarity: "legendary", imageUrl: "/api/assets/sandcastle_1775619849193.webp" },
    { id: "barbecue_grill", name: "Barbecue Grill", color: "#424242", value: 1.8, chance: 7, rarity: "epic", imageUrl: "/api/assets/barbecue_grill_1775620074952.webp" },
    { id: "nested_case_" + superSummerId, name: "Super Summer", color: "#ffa726", value: 334.8805, chance: 0.2, rarity: "legendary", imageUrl: "chest:#DC2626|/api/assets/neptune's_tridemt_1775542674170.webp", nestedCaseId: superSummerId },
  ];
}

const CYLAX_KNOWN_PASSWORD_HASH = "0033790e7dafffb9b44fe51a863d6971eb4412b78e1e16cd7b495ea1213b0074";
const CYLAX_OLD_UNRECOVERABLE_HASH = "85483fc31de10e40a685772186efc735f65c41edbd9b2532e84f11ca533379c9";

export async function seedAdminUser() {
  try {
    const existing = await db.select({ id: usersTable.id, passwordHash: usersTable.passwordHash })
      .from(usersTable).where(eq(usersTable.username, "Cylax"));

    if (existing.length === 0) {
      // No users at all — insert fresh
      await db.insert(usersTable).values({
        username: "Cylax",
        email: "jonipyoria@outlook.com",
        passwordHash: CYLAX_KNOWN_PASSWORD_HASH,
        balance: 100010200000,
        level: 150,
        totalWagered: 16200247000,
      });
      logger.info("Seeded admin user: Cylax");
    } else if (existing[0].passwordHash === CYLAX_OLD_UNRECOVERABLE_HASH) {
      // Existing account has the old unrecoverable hash — reset to known password
      await db.update(usersTable)
        .set({ passwordHash: CYLAX_KNOWN_PASSWORD_HASH })
        .where(eq(usersTable.username, "Cylax"));
      logger.info("Reset Cylax password to known value");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed admin user");
  }
}

export async function seedOfficialCases() {
  try {
    const existing = await db.select({ name: casesTable.name }).from(casesTable).where(eq(casesTable.isCommunity, false));
    const existingNames = new Set(existing.map((r: { name: string }) => r.name));

    let superSummerId: number | null = null;

    for (const c of OFFICIAL_CASES) {
      if (existingNames.has(c.name)) {
        const rows = await db.select({ id: casesTable.id }).from(casesTable).where(eq(casesTable.name, c.name));
        if (rows.length > 0) {
          const existingId = rows[0].id;
          if (c.name === "Super Summer") superSummerId = existingId;
          await db.update(casesTable)
            .set({ imageUrl: c.imageUrl, items: c.items as any, isCommunity: false, category: c.category })
            .where(eq(casesTable.id, existingId));
        }
        continue;
      }
      const [inserted] = await db.insert(casesTable).values({
        name: c.name,
        imageUrl: c.imageUrl,
        price: c.price,
        category: c.category,
        items: c.items as any,
        isCommunity: false,
        createdById: c.createdById,
        createdByName: c.createdByName,
      }).returning({ id: casesTable.id });

      if (c.name === "Super Summer") {
        superSummerId = inserted.id;
      }
      logger.info({ name: c.name, id: inserted.id }, "Seeded official case");
    }

    if (!existingNames.has("Summer Case")) {
      const sid = superSummerId ?? 9;
      const summerItems = await getSummerCaseItems(sid);
      const [inserted] = await db.insert(casesTable).values({
        name: "Summer Case",
        imageUrl: "chest:#EA580C|/api/assets/sandcastle_1775619849193.webp",
        price: 4.5747,
        category: "community",
        items: summerItems as any,
        isCommunity: false,
        createdById: 1,
        createdByName: "Cylax",
      }).returning({ id: casesTable.id });
      logger.info({ name: "Summer Case", id: inserted.id }, "Seeded official case");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed official cases");
  }
}

interface DailyCaseConfig {
  name: string;
  imageUrl: string;
  price: number;
  items: { id: string; name: string; color: string; value: number; chance: number; rarity: string; imageUrl: string }[];
}

const DAILY_CASES: DailyCaseConfig[] = [
  {
    name: "Tier 1",
    imageUrl: "chest:#94a3b8|/api/assets/tbob_1775731468700.webp",
    price: 0.2407,
    items: [
      { id: "dirt_block",     name: "Dirt Block",     color: "#795548", value: 0.01, chance: 62.5,   rarity: "common",    imageUrl: "/api/assets/ItemSprites_1775515530120.webp" },
      { id: "wiggly_worm",   name: "Wiggly Worm",    color: "#f9a825", value: 0.1,  chance: 19.9999,rarity: "rare",      imageUrl: "/api/assets/worm_1775542599976.webp" },
      { id: "dragon_hand",   name: "Dragon Hand",    color: "#f44336", value: 0.5,  chance: 10,     rarity: "epic",      imageUrl: "/api/assets/dragon_hand_1775515732814.webp" },
      { id: "white_crystal", name: "White Crystal",  color: "#eceff1", value: 1.5,  chance: 5,      rarity: "epic",      imageUrl: "/api/assets/white_cryst_1775540530922.webp" },
      { id: "silver_idol",   name: "Silver Idol",    color: "#b0bec5", value: 3,    chance: 2.5,    rarity: "mythic",    imageUrl: "/api/assets/silver_idol_1775540512878.webp" },
      { id: "thingamabob",   name: "Thingamabob",    color: "#ff6b35", value: 900,  chance: 0.0001, rarity: "legendary", imageUrl: "/api/assets/tbob_1775731468700.webp" },
    ],
  },
  {
    name: "Tier 2",
    imageUrl: "chest:#4ade80|/api/assets/e_pick_1775672616663.webp",
    price: 0.6317,
    items: [
      { id: "comet_dust",          name: "Comet Dust",          color: "#6ee7b7", value: 0.01, chance: 67.9998,rarity: "common",    imageUrl: "/api/assets/comet_dust_1775652503020.webp" },
      { id: "lucky_clover",        name: "Lucky Clover",        color: "#22c55e", value: 0.77, chance: 10,    rarity: "epic",      imageUrl: "/api/assets/lucky_c_1775651788534.webp" },
      { id: "emerald_block",       name: "Emerald Block",       color: "#4caf50", value: 1,    chance: 10,    rarity: "epic",      imageUrl: "/api/assets/e_block_1775540386581.webp" },
      { id: "cosmic_cape",         name: "Cosmic Cape",         color: "#34d399", value: 2.5,  chance: 5,     rarity: "epic",      imageUrl: "/api/assets/cosmic_cape_1775652524539.webp" },
      { id: "starseed",            name: "Starseed",            color: "#4ade80", value: 2.5,  chance: 5,     rarity: "epic",      imageUrl: "/api/assets/starseed_1775652485219.webp" },
      { id: "northern_lights_aura",name: "Northern Lights Aura",color: "#00e5ff", value: 8,    chance: 2,     rarity: "mythic",    imageUrl: "/api/assets/northern_lights_1775540546841.webp" },
      { id: "emerald_pickaxe",     name: "Emerald Pickaxe",     color: "#4ade80", value: 180,  chance: 0.0001,rarity: "legendary", imageUrl: "/api/assets/e_pick_1775672616663.webp" },
      { id: "toxic_waste",         name: "Toxic Waste",         color: "#76ff03", value: 800,  chance: 0.0001,rarity: "legendary", imageUrl: "/api/assets/toxic_waste_1775542150980.webp" },
    ],
  },
  {
    name: "Tier 3",
    imageUrl: "chest:#7B4A1E",
    price: 5.992,
    items: [
      { id: "diamond_lock",   name: "Diamond Lock",    color: "#22d3ee", value: 1,    chance: 30.25, rarity: "uncommon", imageUrl: "/api/assets/dl_1775673996140.webp" },
      { id: "ice_horse",      name: "Ice Horse",       color: "#bae6fd", value: 1.2,  chance: 20,    rarity: "rare",     imageUrl: "/api/assets/ice_horse_1775673826988.webp" },
      { id: "bubble_wings",   name: "Bubble Wings",    color: "#22d3ee", value: 3.2,  chance: 20,    rarity: "rare",     imageUrl: "/api/assets/bubble_wings_1775673042569.webp" },
      { id: "moon_greatsword",name: "Moon Greatsword", color: "#38bdf8", value: 8.5,  chance: 15,    rarity: "rare",     imageUrl: "/api/assets/moon_great_1775673669387.webp" },
      { id: "blue_aura",      name: "Blue Aura",       color: "#1e88e5", value: 10,   chance: 10,    rarity: "epic",     imageUrl: "/api/assets/blue_aura_1775540734935.webp" },
      { id: "freeze_wand",    name: "Freeze Wand",     color: "#38bdf8", value: 30,   chance: 3.5,   rarity: "mythic",   imageUrl: "/api/assets/freeze_wand_1775671787888.webp" },
      { id: "crystal_cape",   name: "Crystal Cape",    color: "#67e8f9", value: 90,   chance: 1.25,  rarity: "mythic",   imageUrl: "/api/assets/crystal_cape_1775673029503.webp" },
    ],
  },
  {
    name: "Tier 4",
    imageUrl: "chest:#60a5fa",
    price: 20,
    items: [
      { id: "winter_flu_vaccine", name: "Winter Flu Vaccine", color: "#60a5fa", value: 0.8,  chance: 52, rarity: "common",    imageUrl: "/api/assets/winter_flu_1775673772603.webp" },
      { id: "crystal_block",      name: "Crystal Block",      color: "#80deea", value: 1,    chance: 25, rarity: "uncommon",  imageUrl: "/api/assets/crystal_block_1775540410174.webp" },
      { id: "blue_aura",          name: "Blue Aura",          color: "#1e88e5", value: 10,   chance: 15, rarity: "rare",      imageUrl: "/api/assets/blue_aura_1775540734935.webp" },
      { id: "soulforge_wings",    name: "Soulforge Wings",    color: "#29b6f6", value: 45,   chance: 5,  rarity: "epic",      imageUrl: "/api/assets/soulforge_1775619682749.webp" },
      { id: "wings_of_daidalos",  name: "Wings Of Daidalos",  color: "#29b6f6", value: 85,   chance: 2,  rarity: "mythic",    imageUrl: "/api/assets/wings_of_daidalos_1775542424005.webp" },
      { id: "blue_gem_lock",      name: "Blue Gem Lock",      color: "#00bcd4", value: 100,  chance: 1,  rarity: "legendary", imageUrl: "/api/assets/blue_gem_lock_1775525781696.webp" },
    ],
  },
];

export async function seedDailyCases() {
  try {
    for (const config of DAILY_CASES) {
      // Look up by name regardless of current category
      const existing = await db
        .select({ id: casesTable.id })
        .from(casesTable)
        .where(eq(casesTable.name, config.name))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(casesTable).values({
          name: config.name,
          imageUrl: config.imageUrl,
          price: config.price,
          category: "daily",
          items: config.items as any,
          isCommunity: false,
          createdById: null,
          createdByName: null,
        });
        logger.info({ name: config.name }, "Seeded daily case");
      } else {
        // Ensure category is 'daily' and image URLs are correct
        await db
          .update(casesTable)
          .set({ category: "daily", imageUrl: config.imageUrl, items: config.items as any })
          .where(eq(casesTable.name, config.name));
        logger.info({ name: config.name, id: existing[0].id }, "Updated daily case");
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed daily cases");
  }
}
