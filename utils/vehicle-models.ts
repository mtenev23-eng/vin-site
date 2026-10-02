export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "2ER": "2 Series",
  "3ER": "3 Series",
  "4ER": "4 Series",
  "5ER": "5 Series",
  "6ER": "6 Series",
  "7ER": "7 Series",
  "8ER": "8 Series",

  "A-KLASSE": "A-Class",
  "A-CLASS": "A-Class",

  "C-KLASSE": "C-Class",
  "C-CLASS": "C-Class",

  "E-KLASSE": "E-Class",
  "E-CLASS": "E-Class",

  "S-KLASSE": "S-Class",
  "S-CLASS": "S-Class",

  "GLE": "GLE",
  "GLE-CLASS": "GLE",

  "GLC": "GLC",
  "GLC-CLASS": "GLC",

  "GLS-KLASSE": "GLS",
  "GLS-CLASS": "GLS",

  "GLA-KLASSE": "GLA",
  "GLA-CLASS": "GLA",

  "GLB": "GLB",
  "GLB-CLASS": "GLB",

  "CLA-KLASSE": "CLA",
  "CLA-CLASS": "CLA",

  "CLS-KLASSE": "CLS",
  "CLS-CLASS": "CLS",

  "G-KLASSE": "G-Class",
  "G-CLASS": "G-Class",

  "SL-KLASSE": "SL",
  "SL-CLASS": "SL",

  "SLK-KLASSE": "SLK",
  "SLK-CLASS": "SLK",

  "SLC-CLASS": "SLC",
  "GLK-CLASS": "GLK",
  "GL-CLASS": "GL",
  "CL-CLASS": "CL",
  "ML-CLASS": "ML",

  "AMG-CLASS": "AMG",
  "AMG GT": "AMG GT",
};

export function displayModel(model: string) {
  return MODEL_DISPLAY_NAMES[model.trim().toUpperCase()] || model.trim();
}

export function normalizeModelName(make: string, model: string) {
  const cleaned = model.trim();
  const upper = cleaned.toUpperCase();

  if (make.toUpperCase() === "BMW") {
    return displayModel(cleaned);
  }

  if (make.toUpperCase() === "TESLA") {
    const teslaMap: Record<string, string> = {
      "MODEL 3": "Model 3",
      "MODEL Y": "Model Y",
      "MODEL S": "Model S",
      "MODEL X": "Model X",
      "CYBERTRUCK": "Cybertruck",
    };

    return teslaMap[upper] || cleaned;
  }

  if (
    make.toUpperCase() === "MERCEDES-BENZ" ||
    make.toUpperCase() === "MERCEDES"
  ) {
    return MODEL_DISPLAY_NAMES[upper] || cleaned;
  }

  return cleaned
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function slugifyModel(model: string) {
  return displayModel(model)
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}