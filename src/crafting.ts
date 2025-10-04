// Crafting & Materials System - Harvest, learn recipes, craft items

import { Player, Recipe, Item, Material } from './types';
import { gameState } from './game';
import { send } from './messaging';
import { savePlayer } from './player';

/**
 * Harvest materials from resource nodes in current location
 */
export function harvest(player: Player, materialId?: string): void {
  const location = gameState.gameData.locations.get(player.location);
  if (!location) return;

  if (!location.resources || location.resources.length === 0) {
    send(player, "There's nothing to harvest here.", 'error');
    return;
  }

  // If no material specified and multiple resources, list them
  if (!materialId && location.resources.length > 1) {
    const materialNames = location.resources
      .map(r => {
        const mat = gameState.gameData.materials.get(r.materialId);
        return mat ? mat.name : r.materialId;
      })
      .join(', ');
    send(player, `Which material? (${materialNames.toLowerCase()})`, 'info');
    return;
  }

  // Use first resource if only one and no material specified
  const targetMaterialId = materialId || location.resources[0].materialId;

  // Find the resource node
  const node = location.resources.find(r => r.materialId === targetMaterialId);
  if (!node) {
    send(player, "That resource isn't available here.", 'error');
    return;
  }

  // Check cooldown (key = "locationId_materialId")
  const cooldownKey = `${player.location}_${node.materialId}`;
  const lastHarvest = player.lastHarvest[cooldownKey] || 0;
  const now = Date.now();
  const timeLeft = (lastHarvest + node.cooldown) - now;

  if (timeLeft > 0) {
    const minutes = Math.ceil(timeLeft / 60000);
    send(player, `You must wait ${minutes} minute(s) before harvesting again.`, 'error');
    return;
  }

  // Roll for success
  if (Math.random() > node.chance) {
    send(player, "You search for materials but find nothing useful.", 'error');
    // Still set cooldown on failure
    player.lastHarvest[cooldownKey] = now;
    savePlayer(player);
    return;
  }

  // Calculate amount (parse "min-max" range)
  const [min, max] = node.amount.split('-').map(Number);
  const amount = Math.floor(Math.random() * (max - min + 1)) + min;

  // Get material name
  const material = gameState.gameData.materials.get(node.materialId);
  const materialName = material ? material.name : node.materialId;

  // Add to player's materials
  if (!player.materials[node.materialId]) {
    player.materials[node.materialId] = 0;
  }
  player.materials[node.materialId] += amount;

  // Update cooldown
  player.lastHarvest[cooldownKey] = now;

  send(player, `You harvest ${amount}x ${materialName}!`, 'loot');
  savePlayer(player);
}

/**
 * Learn a recipe from a recipe item
 */
export function learnRecipe(player: Player, item: Item): boolean {
  if (item.type !== 'recipe' || !item.teachesRecipe) {
    send(player, "That's not a recipe.", 'error');
    return false;
  }

  const recipeId = item.teachesRecipe;
  const recipe = gameState.gameData.recipes.get(recipeId);

  if (!recipe) {
    send(player, "Unknown recipe.", 'error');
    return false;
  }

  // Already known?
  if (player.knownRecipes.includes(recipeId)) {
    send(player, "You already know this recipe.", 'error');
    return false;
  }

  // Check level requirement
  if (player.level < recipe.requiredLevel) {
    send(player, `You need to be level ${recipe.requiredLevel} to learn this recipe.`, 'error');
    return false;
  }

  // Learn it
  player.knownRecipes.push(recipeId);
  send(player, `You learn how to craft: ${recipe.name}!`, 'success');
  savePlayer(player);
  return true;
}

/**
 * Show all known recipes
 */
export function showRecipes(player: Player): void {
  if (player.knownRecipes.length === 0) {
    send(player, "You don't know any recipes yet.", 'info');
    return;
  }

  let message = '\n=== Known Recipes ===\n';

  for (const recipeId of player.knownRecipes) {
    const recipe = gameState.gameData.recipes.get(recipeId);
    if (!recipe) continue;

    message += `\n${recipe.name}`;
    if (recipe.requiredLevel > player.level) {
      message += ` (Requires Level ${recipe.requiredLevel})`;
    }
  }

  send(player, message, 'info');
}

/**
 * Examine a recipe (show details and requirements)
 */
export function examineRecipe(player: Player, recipeId: string): void {
  const recipe = gameState.gameData.recipes.get(recipeId);
  if (!recipe) {
    send(player, "Recipe not found.", 'error');
    return;
  }

  // Check if player knows this recipe
  if (!player.knownRecipes.includes(recipeId)) {
    send(player, "You don't know this recipe.", 'error');
    return;
  }

  let message = `\n=== ${recipe.name} ===\n`;
  message += `Required Level: ${recipe.requiredLevel}\n\n`;
  message += 'Materials Required:\n';

  // Show each material with player's current amount
  for (const [materialId, required] of Object.entries(recipe.materials)) {
    const material = gameState.gameData.materials.get(materialId);
    const materialName = material ? material.name : materialId;
    const current = player.materials[materialId] || 0;
    const hasEnough = current >= required;
    
    message += `  ${hasEnough ? '✓' : '✗'} ${materialName}: ${current}/${required}\n`;
  }

  // Show result based on type
  if (recipe.resultType === 'material') {
    const resultMaterial = gameState.gameData.materials.get(recipe.result);
    if (resultMaterial) {
      const amount = recipe.resultAmount || 1;
      message += `\nResult: ${amount}x ${resultMaterial.name}\n`;
      message += `  ${resultMaterial.description}\n`;
      if (resultMaterial.rarity) {
        message += `  Rarity: ${resultMaterial.rarity}\n`;
      }
    }
  } else {
    const resultItem = gameState.gameData.items.get(recipe.result);
    if (resultItem) {
      message += `\nResult: ${resultItem.name}\n`;
      message += `  ${resultItem.description}\n`;
      
      // Show stats if equipment
      if (resultItem.damage) message += `  Damage: +${resultItem.damage}\n`;
      if (resultItem.defense) message += `  Defense: +${resultItem.defense}\n`;
      if (resultItem.health) message += `  Health: +${resultItem.health}\n`;
      if (resultItem.mana) message += `  Mana: +${resultItem.mana}\n`;
    }
  }

  send(player, message, 'info');
}

/**
 * Craft an item from a recipe
 */
export function craft(player: Player, recipeId: string): void {
  const recipe = gameState.gameData.recipes.get(recipeId);
  if (!recipe) {
    send(player, "Recipe not found.", 'error');
    return;
  }

  // Check if player knows this recipe
  if (!player.knownRecipes.includes(recipeId)) {
    send(player, "You don't know this recipe.", 'error');
    return;
  }

  // Check material requirements
  const missingMaterials: string[] = [];
  for (const [materialId, required] of Object.entries(recipe.materials)) {
    const current = player.materials[materialId] || 0;
    if (current < required) {
      const material = gameState.gameData.materials.get(materialId);
      const materialName = material ? material.name : materialId;
      missingMaterials.push(`${materialName} (need ${required}, have ${current})`);
    }
  }

  if (missingMaterials.length > 0) {
    send(player, `Missing materials:\n  ${missingMaterials.join('\n  ')}`, 'error');
    return;
  }

  // Check inventory space (only for item results)
  if (recipe.resultType === 'item') {
    const maxSlots = gameState.gameData.config.gameplay.maxInventorySlots;
    if (player.inventory.length >= maxSlots) {
      send(player, "Your inventory is full!", 'error');
      return;
    }
  }

  // Consume materials
  for (const [materialId, required] of Object.entries(recipe.materials)) {
    player.materials[materialId] -= required;
    if (player.materials[materialId] <= 0) {
      delete player.materials[materialId];
    }
  }

  // Build consumed materials message
  const consumed = Object.entries(recipe.materials)
    .map(([materialId, amount]) => {
      const material = gameState.gameData.materials.get(materialId);
      const materialName = material ? material.name : materialId;
      return `${amount}x ${materialName}`;
    })
    .join(', ');

  // Create result based on type
  if (recipe.resultType === 'material') {
    // Create material
    const resultMaterial = gameState.gameData.materials.get(recipe.result);
    if (!resultMaterial) {
      send(player, "Error: Result material not found.", 'error');
      return;
    }

    const amount = recipe.resultAmount || 1;
    if (!player.materials[recipe.result]) {
      player.materials[recipe.result] = 0;
    }
    player.materials[recipe.result] += amount;

    send(player, `You craft ${amount}x ${resultMaterial.name}!`, 'success');
    send(player, `Materials consumed: ${consumed}`, 'info');
  } else {
    // Create item
    const resultItem = gameState.gameData.items.get(recipe.result);
    if (!resultItem) {
      send(player, "Error: Result item not found.", 'error');
      return;
    }

    const craftedItem = { ...resultItem };
    player.inventory.push(craftedItem);

    send(player, `You craft ${craftedItem.name}!`, 'success');
    send(player, `Materials consumed: ${consumed}`, 'info');
  }
  
  savePlayer(player);
}
