import { parse } from "@std/csv";

function readComponentValueData() {
  const data = Deno.readFileSync(".raw/component_value.csv");
  const decoder = new TextDecoder("ascii");
  const text = decoder.decode(data);
  return parse(text, { separator: ";" });
}

function readFoodData() {
  const data = Deno.readFileSync(".raw/food.csv");
  const decoder = new TextDecoder("ascii");
  const text = decoder.decode(data);
  return parse(text, { separator: ";" });
}

function readFoodAddUnitData() {
  const data = Deno.readFileSync(".raw/foodaddunit.csv");
  const decoder = new TextDecoder("ascii");
  const text = decoder.decode(data);
  return parse(text, { separator: ";" });
}

function readFoodUnitData() {
  const data = Deno.readFileSync(".raw/foodunit_FI.csv");
  const decoder = new TextDecoder("ascii");
  const text = decoder.decode(data);
  return parse(text, { separator: ";" });
}

function readIgClassData() {
  const data = Deno.readFileSync(".raw/igclass_FI.csv");
  const decoder = new TextDecoder("ascii");
  const text = decoder.decode(data);
  return parse(text, { separator: ";" });
}

function readProcessData() {
  const data = Deno.readFileSync(".raw/process_FI.csv");
  const decoder = new TextDecoder("ascii");
  const text = decoder.decode(data);
  return parse(text, { separator: ";" });
}

const DATA = {
  componentValue: readComponentValueData(),
  food: readFoodData(),
  foodAddUnit: readFoodAddUnitData(),
  foodUnit: readFoodUnitData(),
  igClass: readIgClassData(),
  process: readProcessData(),
};

const INDEX = {
  componentValue: {
    FOODID: DATA.componentValue.at(0).indexOf("FOODID"),
    EUFDNAME: DATA.componentValue.at(0).indexOf("EUFDNAME"),
    BESTLOC: DATA.componentValue.at(0).indexOf("BESTLOC"),
  },
  food: {
    FOODID: DATA.food.at(0).indexOf("FOODID"),
    FOODNAME: DATA.food.at(0).indexOf("FOODNAME"),
    PROCESS: DATA.food.at(0).indexOf("PROCESS"),
    IGCLASSP: DATA.food.at(0).indexOf("IGCLASSP"),
  },
  foodAddUnit: {
    FOODID: DATA.foodAddUnit.at(0).indexOf("FOODID"),
    FOODUNIT: DATA.foodAddUnit.at(0).indexOf("FOODUNIT"),
    MASS: DATA.foodAddUnit.at(0).indexOf("MASS"),
  },
  foodUnit: {
    THSCODE: DATA.foodUnit.at(0).indexOf("THSCODE"),
    DESCRIPT: DATA.foodUnit.at(0).indexOf("DESCRIPT"),
    LANG: DATA.foodUnit.at(0).indexOf("LANG"),
  },
  igClass: {
    THSCODE: DATA.igClass.at(0).indexOf("THSCODE"),
    DESCRIPT: DATA.igClass.at(0).indexOf("DESCRIPT"),
    LANG: DATA.igClass.at(0).indexOf("LANG"),
  },
  process: {
    THSCODE: DATA.process.at(0).indexOf("THSCODE"),
    DESCRIPT: DATA.process.at(0).indexOf("DESCRIPT"),
    LANG: DATA.process.at(0).indexOf("LANG"),
  },
};

function processFood(id) {
  // read the food item from the food data
  const food = DATA.food.slice(1).find((item) => item[INDEX.food.FOODID] === id);
  if (!food) throw new Error(`Food item with ID ${id} not found.`);

  // find the ingredient class
  const igClass = DATA.igClass
    .slice(1)
    .find((item) => item[INDEX.igClass.THSCODE] === food[INDEX.food.IGCLASSP]);
  const classDescription = igClass ? igClass[INDEX.igClass.DESCRIPT] : null;

  // find the process description
  const process = DATA.process
    .slice(1)
    .find((item) => item[INDEX.process.THSCODE] === food[INDEX.food.PROCESS]);
  const processDescription = process ? process[INDEX.process.DESCRIPT] : null;

  // read the nutritional values (kcal, fat, and protein)
  const componentValues = DATA.componentValue
    .slice(1)
    .filter((item) => item[INDEX.componentValue.FOODID] === id);
  const kjValue = componentValues.find((item) => item[INDEX.componentValue.EUFDNAME] === "ENERC");
  const protValue = componentValues.find((item) => item[INDEX.componentValue.EUFDNAME] === "PROT");

  const kj = kjValue ? parseFloat(kjValue[INDEX.componentValue.BESTLOC]) : null;
  const kcal = kj ? Math.round(kj / 4.184) : null;
  const protein = protValue ? parseFloat(protValue[INDEX.componentValue.BESTLOC]) : null;

  const nutrients = {
    kcal: kcal,
    protein: protein,
  };

  // read the common food units
  const foodAddUnits = DATA.foodAddUnit
    .slice(1)
    .filter((item) => item[INDEX.foodAddUnit.FOODID] === id);

  const units = foodAddUnits
    .filter((item) => {
      const allowlist = ["KPL_S", "KPL_M", "KPL_L", "KPL_VALM", "PORTS", "PORTM", "PORTL"];
      return allowlist.includes(item[INDEX.foodAddUnit.FOODUNIT]);
    })
    .map((item) => {
      const unit = item[INDEX.foodAddUnit.FOODUNIT];
      const description = DATA.foodUnit.find((item) => item[INDEX.foodUnit.THSCODE] === unit);
      return {
        unit: unit,
        description: description ? description[INDEX.foodUnit.DESCRIPT] : unit,
        mass: parseFloat(item[INDEX.foodAddUnit.MASS]),
      };
    });

  // return the processed food item
  return {
    id: food[INDEX.food.FOODID],
    name: food[INDEX.food.FOODNAME],
    class: classDescription,
    process: processDescription,
    nutrients: nutrients,
    units: units,
  };
}

const processed = DATA.food.slice(1).map((item) => processFood(item[INDEX.food.FOODID]));
Deno.writeTextFileSync("fineli.json", JSON.stringify(processed, null, 2));
