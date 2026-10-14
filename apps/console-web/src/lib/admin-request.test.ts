import {it,expect} from "vitest";
import {adminEntitlement,adminSuspension,adminPath,adminQuery,safeAdminReturn} from "./admin-request";
const common={expectedVersion:3,reasonCode:"SUPPORT_REQUEST",confirmation:true};
it("separates suspension and entitlement payloads",()=>{expect(adminSuspension({...common,suspended:true})).toBe(true);expect(adminEntitlement({...common,offer:"FREE",monthlyLimit:null})).toBe(true);expect(adminEntitlement({...common,suspended:true})).toBe(false);});
it.each([{expectedVersion:-1},{expectedVersion:1.5},{reasonCode:"free text"},{confirmation:false},{role:"ADMIN"},{confirmed:true}])("rejects invalid administrative input %j",extra=>{expect(adminSuspension({...common,suspended:true,...extra})).toBe(false);});
it.each(["q=a&q=b","state=UNKNOWN","cursor=9223372036854775808","offer=free","target=2","limit=0","q=%0A"]) ("rejects invalid account filters %s",q=>expect(adminQuery("admin/users",new URLSearchParams(q))).toBeNull());
it("accepts only bounded same-origin administrative returns",()=>{expect(safeAdminReturn("/en/account/admin/users?q=Morgan&state=SUSPENDED")).not.toBeNull();for(const p of ["https://evil.example/account/admin/users","//evil.example","/account/admin/users?role=ADMIN","/account/admin/users#fragment"])expect(safeAdminReturn(p)).toBeNull();});
it("opens the scoped journal and rejects overlong IDs or role mutations",()=>{expect(adminPath("GET","admin/users/9007199254740993/events")).toBe(true);expect(adminPath("POST","admin/users/42/suspension")).toBe(true);expect(adminPath("PATCH","admin/users/42/role")).toBe(false);expect(adminPath("GET","admin/users/9223372036854775808")).toBe(false);});

import {safeAccountReturn} from "./account-return";
it("preserves filtered administrative detail return after reauthentication",()=>{const path="/en/account/admin/users/9007199254740993?returnTo="+encodeURIComponent("/en/account/admin/users?q=Morgan");expect(safeAccountReturn(path)).toBe(path);expect(safeAccountReturn("/account/admin/users/42?returnTo=https%3A%2F%2Fevil.example")).toBe("/account/sites");});
