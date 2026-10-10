import { careerMonthIndex } from "./candidateCareerExperience";
import { validEmploymentTitle } from "./candidate360Employment";
import { projectDateIsCurrent, projectDateRange } from "./projectDateEvidence";

/** Explicit Project + Role cards. An undated project remains undated, and a
 * nearby company is not treated as the project's client or employer. */
export function labelledProjectCards(source: string) {
  const lines = source.normalize("NFKC").replace(/\r/g, "").split("\n");
  const result: Array<{name:string;client:string;role:string;start:string;end:string;excerpt:string}> = [];
  for (let index=0; index<lines.length; index++) {
    const project = lines[index].trim().match(/^Project(?:\s+(?:Name|Title))?\s*:\s*(\S.{3,159})$/i);
    if (!project) continue;
    const next = lines.findIndex((line, offset) => offset>index && /^\s*(?:Project(?:\s+(?:Name|Title))?\s*:|(?:EMPLOYMENT|WORK EXPERIENCE|EDUCATION|CERTIFICATIONS?|REFERENCES)\s*$)/i.test(line));
    const blockEnd = Math.min(next<0?lines.length:next,index+11);
    const initialBlock = lines.slice(index+1, blockEnd);
    const clientPositions = initialBlock.flatMap((line, offset) => /^\s*(?:Client|Customer)\s*:\s*\S/i.test(line) ? [offset] : []);
    const block = clientPositions.length>1 ? initialBlock.slice(0, clientPositions[1]) : initialBlock;
    if (block.some(line => /^\s*(?:Start Date|End Date|From|To)\s*:?\s*$/i.test(line) || /^\s*(?:Start Date|End Date|From|To)\s*:\s*\S/i.test(line))) continue;
    if (block.some(line => {
      const range = projectDateRange(line);
      if (!range) return false;
      const start = careerMonthIndex(range[1]);
      const end = careerMonthIndex(range[2], projectDateIsCurrent(range[2]));
      return start !== null && end !== null && start > end;
    })) continue;
    // The established dated-card parser owns this shape and its exact date
    // notation. Do not produce a second, differently normalized assignment.
    if (block.some(line=>/^\s*(?:Project\s+)?Duration\s*:/i.test(line))) continue;
    const roleLine = block.find(line => /^\s*(?:Project\s+)?Role\s*:\s*\S/i.test(line));
    const role = validEmploymentTitle(roleLine?.replace(/^\s*(?:Project\s+)?Role\s*:\s*/i, "") || "");
    if (!role || !/\b(?:consultant|developer|analyst|architect|engineer|lead|manager|specialist|tester|administrator|functional|technical)\b/i.test(role)) continue;
    const inlineDates=projectDateRange(project[1]);
    let name=project[1].trim();
    let dates=inlineDates && (inlineDates.index??-1)>=5 ? inlineDates : null;
    if(dates) name=name.slice(0,dates.index).replace(/[,;\s-]+$/,"").trim();
    if(name.length<5 || name.length>120 || /@|https?:|\b(?:responsibilities|work description)\s*:/i.test(name)) continue;
    if(dates) {
      const from=careerMonthIndex(dates[1]);
      const to=careerMonthIndex(dates[2],projectDateIsCurrent(dates[2]));
      if(from===null||to===null||from>to) continue;
    }
    const clientLine=block.find(line=>/^\s*(?:Client|Customer)\s*:\s*\S/i.test(line));
    const client=clientLine?.replace(/^\s*(?:Client|Customer)\s*:\s*/i,"").trim()||"";
    if(client.length>120 || /@|https?:/i.test(client)) continue;
    const dateValue=(value:string)=>value.replace(/[’']/g," ").replace(/\s+/g," ").trim();
    result.push({name,client,role,start:dates?dateValue(dates[1]):"",end:dates?dateValue(dates[2]):"",excerpt:[lines[index],...block.slice(0,4)].join(" ").slice(0,400)});
  }
  return result;
}
