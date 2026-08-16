/**
 * Scatter registry — runtime record of where ScatterProps placed major
 * buildings (barns, sheds, keeper huts) and trees (oaks, pines). Roads read
 * it during generation so branches can connect the scattered buildings
 * without duplicating the scatter logic; GrassField reads `trees` to spawn a
 * dense grass patch at every tree base. Deterministic: ScatterProps placement
 * is seeded, so the registry content is identical for the same world seed.
 */
export const scatterRegistry = {
  buildings: [],
  trees: [],
  clear() {
    this.buildings.length = 0;
    this.trees.length = 0;
  },
  add(cellX, cellZ, worldX, worldY, worldZ) {
    this.buildings.push({ cellX, cellZ, x: worldX, y: worldY, z: worldZ });
  },
  addTree(cellX, cellZ, worldX, worldY, worldZ) {
    this.trees.push({ cellX, cellZ, x: worldX, y: worldY, z: worldZ });
  },
};
