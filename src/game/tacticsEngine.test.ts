import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildElmodorWatchtowerMap,
  gridToScreen,
  pickTileAtMapPoint,
  isTileOccluded,
  ISO_CONFIG,
  TileData,
} from './mapTopology';
import {
  createInitialUnits,
  computeReachableTiles,
  findLongRangePath,
  calculateCombatForecast,
  chooseEnemyReaction,
  getAttackModifications,
  getAvailableReactions,
  resolveCombatClash,
  computePantherTurn,
  checkBattleOutcome,
  getAttackAngle,
  tileKey,
  GridPos,
} from './tacticsEngine';

test('30x30 map dimensions, balanced roster, all enemies named Shadow, and single Reaction per unit', () => {
  const tiles: TileData[][] = buildElmodorWatchtowerMap();
  assert.equal(tiles.length, 30);
  assert.equal(tiles[0].length, 30);

  const units = createInitialUnits();
  const enemies = units.filter((u) => u.faction === 'enemy');
  assert.equal(enemies.length, 3);
  for (const enemy of enemies) {
    assert.equal(enemy.name, 'Shadow', 'All enemy panthers must be named Shadow');
    assert.equal(enemy.signatureReaction, 'shadow_veil');
  }

  for (const unit of units) {
    const t = tiles[unit.y][unit.x];
    assert.equal(t.blocked, false, `${unit.name} spawned on blocked tile (${unit.x},${unit.y})`);
    assert.ok(unit.vitality >= 5 && unit.vitality <= 12, `${unit.name} vitality must be low-number`);
    assert.ok(unit.essence >= 2 && unit.essence <= 8, `${unit.name} essence must be low-number`);
    assert.ok(unit.evasion >= 1 && unit.evasion <= 6, `${unit.name} evasion must be low-number`);
    assert.ok(unit.reaction >= 1 && unit.reaction <= 2, `${unit.name} reaction must be low-number`);

    // Strictly ONE signature defensive Reaction (+ Endure/none)
    const reactions = getAvailableReactions(unit);
    assert.equal(reactions.length, 2, `${unit.name} must have Endure + 1 signature Reaction`);
    assert.equal(reactions[0].id, 'none');
    assert.equal(reactions[1].id, unit.signatureReaction);
  }
});

test('Aryon Fire Mage kit and Aiori Ferunium/Auruinum elemental sword kits match specifications', () => {
  const tiles = buildElmodorWatchtowerMap();
  const units = createInitialUnits();
  const aryon = units.find((u) => u.id === 'aryon')!;
  const aiori = units.find((u) => u.id === 'aiori')!;
  const shadow = { ...units.find((u) => u.id === 'panther_flank')!, x: aiori.x, y: aiori.y - 1 };

  // Aryon Fire Mage kit
  assert.equal(aryon.signatureReaction, 'escudo_ergeo');
  assert.ok(aryon.skills.some((s) => s.category === 'attack' && s.name === 'Blood-Rush Strike'));
  assert.ok(aryon.skills.some((s) => s.category === 'essence' && s.name === 'Globus Inflamus'));
  assert.ok(aryon.skills.some((s) => s.category === 'essence' && s.name === 'Chamus Continuos'));
  assert.ok(aryon.skills.some((s) => s.category === 'defense'));

  const aryonAttackMods = getAttackModifications(
    aryon,
    aryon.skills.find((s) => s.category === 'attack')!
  );
  assert.equal(aryonAttackMods.length, 3);
  assert.equal(aryonAttackMods[2].name, 'Blood Boil');

  // Aiori Elemental Sword kit
  assert.equal(aiori.signatureReaction, 'steel_guard');
  const ferunium = aiori.skills.find((s) => s.id === 'ferunium_blade')!;
  const auruinum = aiori.skills.find((s) => s.id === 'auruinum_blade')!;
  const baseStrike = aiori.skills.find((s) => s.category === 'attack')!;
  assert.equal(ferunium.element, 'fire');
  assert.equal(ferunium.imbuesSword, 'ferunium');
  assert.equal(auruinum.element, 'arcane');
  assert.equal(auruinum.imbuesSword, 'auruinum');

  // Imbuing Ferunium Blade adds Fire damage bonus to subsequent physical attacks
  const feruniumRes = resolveCombatClash(
    aiori,
    shadow,
    ferunium,
    tiles,
    [aiori, shadow],
    'standard',
    'none',
    () => 0.1
  );
  assert.equal(feruniumRes.imbuedSword, 'ferunium');

  const unimbuedFc = calculateCombatForecast(aiori, shadow, baseStrike, tiles, [aiori, shadow], 'standard', 'none');
  const imbuedAiori = { ...aiori, swordElement: 'ferunium' as const };
  const imbuedFc = calculateCombatForecast(imbuedAiori, shadow, baseStrike, tiles, [imbuedAiori, shadow], 'standard', 'none');
  assert.equal(imbuedFc.expectedDamage, unimbuedFc.expectedDamage + 1);
});

test('all three exterior staircases and interior tower spiral stairs connect meadow to upper battlement (h=6)', () => {
  const tiles: TileData[][] = buildElmodorWatchtowerMap();
  const units = createInitialUnits();
  const aiori = units.find((u) => u.id === 'aiori')!;

  const toCourtyard: GridPos[] | null = findLongRangePath(aiori, 14, 14, tiles, []);
  if (!toCourtyard || toCourtyard.length === 0) {
    throw new Error('Hero must be able to ascend to watchtower courtyard');
  }

  for (let i = 1; i < toCourtyard.length; i++) {
    const prevPos: GridPos = toCourtyard[i - 1];
    const nextPos: GridPos = toCourtyard[i];
    const prevTile: TileData = tiles[prevPos.y][prevPos.x];
    const nextTile: TileData = tiles[nextPos.y][nextPos.x];
    assert.equal(nextTile.blocked, false);
    assert.ok(nextTile.height - prevTile.height <= aiori.jmp, `Illegal jump at step ${i}`);
  }

  const toBattlement = findLongRangePath(aiori, 14, 6, tiles, []);
  assert.ok(toBattlement && toBattlement.length > 0, 'Hero must be able to climb spiral stairs to h=6 battlement');
  assert.equal(tiles[6][14].height, 6);
});

test('sheer plateau cliff blocks direct vertical climbing while stone stairs allow ascent', () => {
  const tiles = buildElmodorWatchtowerMap();
  const units = createInitialUnits();
  const aiori = { ...units[0], x: 11, y: 18 };
  const reachable = computeReachableTiles(aiori, tiles, [aiori]);

  assert.equal(reachable.has(tileKey(11, 17)), false);
  assert.equal(reachable.has(tileKey(13, 18)), true);
  assert.equal(reachable.has(tileKey(13, 17)), true);
});

test('blind-angle occlusion and isometric tile picking remain accurate', () => {
  const tiles = buildElmodorWatchtowerMap();
  assert.equal(isTileOccluded(15, 4, tiles), true);
  assert.equal(isTileOccluded(14, 24, tiles), false);

  const pt = gridToScreen(14, 23, tiles[23][14].height, ISO_CONFIG);
  const picked = pickTileAtMapPoint(pt.x, pt.y, tiles, ISO_CONFIG);
  assert.ok(picked);
  assert.equal(picked.x, 14);
  assert.equal(picked.y, 23);
});

test('Shadow Smoke Screen grants +25% Hit & +10% Crit from shadow and reveals Shadow upon attacking', () => {
  const tiles = buildElmodorWatchtowerMap();
  const units = createInitialUnits();
  const aiori = { ...units.find((u) => u.id === 'aiori')!, x: 14, y: 14, facing: 'NE' as const };
  const visibleShadow = {
    ...units.find((u) => u.id === 'panther_alpha')!,
    x: 14,
    y: 13,
    hidden: false,
  };
  const hiddenShadow = { ...visibleShadow, hidden: true };
  const claws = visibleShadow.skills.find((s) => s.category === 'attack')!;

  const visibleFc = calculateCombatForecast(visibleShadow, aiori, claws, tiles, [visibleShadow, aiori], 'standard', 'none');
  const ambushFc = calculateCombatForecast(hiddenShadow, aiori, claws, tiles, [hiddenShadow, aiori], 'standard', 'none');

  assert.equal(ambushFc.fromShadowBonus, true);
  assert.ok(ambushFc.hitChance > visibleFc.hitChance, 'Attacking from Shadow must increase Hit chance');
  assert.equal(ambushFc.critChance, Math.min(85, visibleFc.critChance + 10));

  const clash = resolveCombatClash(hiddenShadow, aiori, claws, tiles, [hiddenShadow, aiori], 'standard', 'none', () => 0.15);
  assert.equal(clash.revealedAttacker, true, 'Attacking from Smoke Screen must reveal Shadow');

  // While hidden, Shadow also gains +2 Evasion against incoming hero attacks
  const aryon = { ...units.find((u) => u.id === 'aryon')!, x: 14, y: 16 };
  const globus = aryon.skills.find((s) => s.id === 'globus_inflamus')!;
  const fcVsVisible = calculateCombatForecast(aryon, visibleShadow, globus, tiles, [aryon, visibleShadow], 'standard', 'none');
  const fcVsHidden = calculateCombatForecast(aryon, hiddenShadow, globus, tiles, [aryon, hiddenShadow], 'standard', 'none');
  assert.equal(fcVsHidden.defenderTotalEvasion, fcVsVisible.defenderTotalEvasion + 2);
});

test('single signature Reactions (Escudo Ergeo, Steel Guard, Shadow Veil) resolve combat cleanly', () => {
  const tiles = buildElmodorWatchtowerMap();
  const units = createInitialUnits();
  const aryon = { ...units.find((u) => u.id === 'aryon')!, x: 14, y: 14 };
  const aiori = { ...units.find((u) => u.id === 'aiori')!, x: 15, y: 14 };
  const shadow = { ...units.find((u) => u.id === 'panther_alpha')!, x: 14, y: 11, facing: 'SW' as const };
  const globus = aryon.skills.find((s) => s.id === 'globus_inflamus')!;
  const claws = shadow.skills.find((s) => s.category === 'attack')!;

  // Shadow Veil reduces hit chance and is the ONLY reaction Shadow AI picks
  const baseVsShadow = calculateCombatForecast(aryon, shadow, globus, tiles, [aryon, shadow], 'standard', 'none');
  const veilVsShadow = calculateCombatForecast(aryon, shadow, globus, tiles, [aryon, shadow], 'standard', 'shadow_veil');
  assert.ok(veilVsShadow.hitChance < baseVsShadow.hitChance);
  assert.equal(chooseEnemyReaction(shadow, baseVsShadow), 'shadow_veil');

  const veilMiss = resolveCombatClash(aryon, shadow, globus, tiles, [aryon, shadow], 'standard', 'shadow_veil', () => 0.99);
  assert.equal(veilMiss.outcomeKind, 'evaded');
  assert.equal(veilMiss.finalDamage, 0);

  // Aryon's Escudo Ergeo absorbs up to 3 DMG & costs 1 React + 1 Ess
  const escudoRes = resolveCombatClash(shadow, aryon, claws, tiles, [shadow, aryon], 'standard', 'escudo_ergeo', () => 0.1);
  assert.equal(escudoRes.outcomeKind, 'shielded');
  assert.equal(escudoRes.defenderReactionSpent, 1);
  assert.equal(escudoRes.defenderEssenceSpent, 1);

  // Aiori's Steel Guard reduces DMG & costs 1 React, 0 Ess
  const guardRes = resolveCombatClash(shadow, aiori, claws, tiles, [shadow, aiori], 'standard', 'steel_guard', () => 0.1);
  assert.equal(guardRes.outcomeKind, 'blocked');
  assert.equal(guardRes.defenderReactionSpent, 1);
  assert.equal(guardRes.defenderEssenceSpent, 0);
});

test('attack angle detection, Shadow AI Smoke Screen / movement, and victory detection work', () => {
  assert.equal(getAttackAngle(14, 15, 14, 14, 'SW'), 'FRONT');
  assert.equal(getAttackAngle(14, 13, 14, 14, 'SW'), 'BACK');
  assert.equal(getAttackAngle(15, 14, 14, 14, 'SW'), 'SIDE');

  const tiles = buildElmodorWatchtowerMap();
  const units = createInitialUnits();
  const shadow = units.find((u) => u.id === 'panther_alpha')!;
  const decision = computePantherTurn(shadow, tiles, units);
  assert.ok(decision.movePath.length >= 1);
  const end = decision.movePath[decision.movePath.length - 1];
  assert.equal(tiles[end.y][end.x].blocked, false);
  // Out of melee range on turn 1 while not hidden -> pops Smoke Screen to stealth!
  assert.equal(decision.useSmokeScreen, true);

  const allEnemiesDead = units.map((u) =>
    u.faction === 'enemy' ? { ...u, alive: false, vitality: 0 } : u
  );
  assert.equal(checkBattleOutcome(allEnemiesDead), 'victory');

  // If only one hero falls, battle must continue
  const oneHeroFallen = units.map((u) =>
    u.id === 'aryon' ? { ...u, alive: false, vitality: 0 } : u
  );
  assert.equal(checkBattleOutcome(oneHeroFallen), 'playing');

  // If BOTH heroes fall, battle must immediately resolve to defeat
  const bothHeroesFallen = units.map((u) =>
    u.faction === 'hero' ? { ...u, alive: false, vitality: 0 } : u
  );
  assert.equal(checkBattleOutcome(bothHeroesFallen), 'defeat');
});
