import axios from "axios";
import * as XLSX from "xlsx";
// locals
const columnTypeDecodesMap: any = {
  b: (input: any) => ({ type: "Boolean", value: !!input }),
  n: (input: any) => {
    let output = Number(input);
    if (Number.isNaN(output)) {
      output = 0;
    }
    return { type: "Number", value: output };
  },
  e: (input: any) => ({ type: "Error", value: new Error(input) }),
  s: (input: any) => ({ type: "String", value: `${input || ""}` }),
  d: (input: any) => ({ type: "Date", value: new Date(input) })
};
const columnTypeDecode = (columnData: any) => {
  let decoded: any = columnData.v;
  if (typeof columnTypeDecodesMap[columnData.t] !== "undefined") {
    decoded = columnTypeDecodesMap[columnData.t](columnData.v);
  }
  return decoded;
};
const extractHeaders = (ws: any) => {
  const header: Array<any> = [];
  const columnCount = XLSX.utils.decode_range(ws["!ref"]).e.c + 1;
  for (let i = 0; i < columnCount; ++i) {
    const columnIndex = `${XLSX.utils.encode_col(i)}1`;
    const columnData = ws[columnIndex];
    if (typeof columnData !== "undefined") {
      const decodeColumn = columnTypeDecode(columnData);
      header[i] = {
        name: decodeColumn.value,
        type: decodeColumn.type
      };
    }
  }
  return header;
};

export default class Api {
  static GATEWAY = `//us-central1-plasma-card-258813.cloudfunctions.net`;
  fetchDocument(documentId: string) {
    let apiUrl = `${Api.GATEWAY}/proxy-sheet?id=${encodeURIComponent(
      documentId
    )}`;
    // apiUrl = `${window.location.href}database.xlsx`;
    console.debug("Fetching document from", apiUrl);
    return axios
      .get(apiUrl, {
        responseType: "arraybuffer"
      })
      .then(response => {
        const data = new Uint8Array(response.data);
        const opts: XLSX.ParsingOptions = {
          type: "array",
          cellDates: true,
          cellStyles: true
        };
        const workbook = XLSX.read(data, opts);
        const sheets = workbook.SheetNames.map(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const records = XLSX.utils.sheet_to_json(worksheet);
          const headers = extractHeaders(worksheet);
          return {
            name: sheetName,
            headers,
            records,
            active: false
          };
        });
        const database = {
          documentId,
          sheets
        };
        return database;
      })
      .catch(error => console.log(error));
  }
}
