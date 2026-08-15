/**
 * Scatter registry — runtime record of where ScatterProps placed major
 * buildings (barns, sheds, keeper huts). Roads read it during generation
 * so branches can connect the scattered buildings without duplicating the
 * scatter logic. Deterministic: ScatterProps placement is seeded, so the
 * registry content is identical for the same world seed.
 */
export const scatterRegistry = {
  buildings: [],
  clear() {
    this.buildings.length = 0;
  },
  add(cellX, cellZ, worldX, worldY, worldZ) {
    this.buildings.push({ cellX, cellZ, x: worldX, y: worldY, z: worldZ });
  },
};
