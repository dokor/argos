import { it, expect } from "vitest";
import { feedbackPayload, feedbackTreatment } from "./feedback-request";
import { adminPath, adminQuery } from "./admin-request";
it("bounds descriptions, rejects traps, forged context and ambiguous references", () => {
  expect(feedbackPayload({type:"SUGGESTION",description:"Useful idea"})).toBe(true);
  for(const body of [{type:"BUG",description:" "},{type:"BUG",description:"x".repeat(4001)},{type:"BUG",description:"x",website:"bot"},{type:"BUG",description:"x",page:"https://private.example"},{type:"BUG",description:"x",ownerId:"7"},{type:"BUG",description:"x",runId:"9223372036854775808"},{type:"FALSE_POSITIVE",description:"x",findingKey:"http.hsts"},{type:"FALSE_POSITIVE",description:"x",findingKey:"http.hsts",runId:"3",reportToken:"t".repeat(43)}]) expect(feedbackPayload(body)).toBe(false);
  expect(feedbackPayload({type:"FALSE_POSITIVE",description:"Incorrect fixture",findingKey:"http.hsts",reportToken:"t".repeat(43)})).toBe(true);
});
it("allows only admin feedback reads and bounded explicit status mutations",()=>{
  expect(adminPath("GET","admin/feedback/42")).toBe(true);expect(adminPath("PATCH","admin/feedback/42")).toBe(true);
  expect(adminPath("DELETE","admin/feedback/42")).toBe(false);
  expect(adminQuery("admin/feedback",new URLSearchParams("type=BUG&status=OPEN&limit=20"))?.toString()).toBe("type=BUG&status=OPEN&limit=20");
  expect(adminQuery("admin/feedback",new URLSearchParams("reportToken=secret"))).toBeNull();
  expect(feedbackTreatment({status:"CONFIRMED",expectedStatus:"OPEN"})).toBe(true);
  expect(feedbackTreatment({status:"CONFIRMED",expectedStatus:"OPEN",score:100})).toBe(false);
});
