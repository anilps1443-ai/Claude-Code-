// The pack and the van it powers. Every number the figure shows comes from here.

export const MODULES = 12;
export const SERIES_PER_MODULE = 9;
export const PARALLEL = 2;
export const SERIES = MODULES * SERIES_PER_MODULE; // 108s
export const CELLS = SERIES * PARALLEL; // 216 cells
export const CELL_AH = 102.5;
export const NOMINAL_CELL_V = 3.65;
export const CAPACITY_KWH = (SERIES * NOMINAL_CELL_V * CELL_AH * PARALLEL) / 1000; // 80.8 kWh
export const CONSUMPTION = 0.27; // kWh per km, laden panel van, mixed cycle

// Open-circuit voltage of one NMC cell against state of charge.
const OCV = [[0, 3.0], [0.05, 3.38], [0.1, 3.47], [0.3, 3.58], [0.5, 3.65], [0.7, 3.79], [0.9, 4.0], [1, 4.15]];
const lerpTable = (table, x) => {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    const [x0, y0] = table[i - 1];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return table[table.length - 1][1];
};

export const cellVolts = (soc) => lerpTable(OCV, soc);
export const packVolts = (soc) => SERIES * cellVolts(soc);
export const energyKwh = (soc) => CAPACITY_KWH * soc;
export const rangeKm = (soc) => energyKwh(soc) / CONSUMPTION;
