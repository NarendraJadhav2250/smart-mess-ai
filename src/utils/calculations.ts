export const calculateWaste=(prepared:number,consumed:number)=>prepared>consumed?prepared-consumed:0
export const calculateShortage=(prepared:number,consumed:number)=>consumed>prepared?consumed-prepared:0
export const calculatePredictionError=(predicted:number,actual:number)=>Math.abs(predicted-actual)
