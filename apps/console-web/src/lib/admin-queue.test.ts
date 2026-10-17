import {expect,it} from "vitest";
import {adminPath,adminQuery,safeAdminQueueReturn,safeAdminReturn,safeAdminRunReturn} from "./admin-request";
import {safeAccountReturn} from "./account-return";
it("allows only read-only task endpoints and bounded filters", () => {
  expect(adminPath("GET","admin/queue/tasks/BATCH/42")).toBe(true);
  expect(adminPath("POST","admin/queue/tasks/BATCH/42")).toBe(false);
  for(const query of ["type=evil","type=RUN&type=BATCH","status=FAILED","page=0","page=10001","from=2026-02-30","from=2026-10-17&until=2026-10-01","sort=id;delete","token=private"])
    expect(adminQuery("admin/queue/tasks",new URLSearchParams(query)),query).toBeNull();
  expect(adminQuery("admin/queue/tasks",new URLSearchParams("type=RUN&site=www.example.com&user=anonymous&sort=started&page=3"))).not.toBeNull();
});
it("preserves safe filtered queue returns through account navigation and details", () => {
  const back="/account/admin/queue?site=www.example.com&type=BATCH&page=2";
  for(const validate of [safeAdminQueueReturn,safeAdminReturn,safeAdminRunReturn,safeAccountReturn]) expect(validate(back)).toBe(back);
  const detail="/account/admin/queue/BATCH/42?returnTo="+encodeURIComponent(back);
  expect(safeAccountReturn(detail)).toBe(detail);
  for(const unsafe of ["https://evil.example/account/admin/queue","//evil.example","/account/admin/queue?token=private","/account/admin/queue?returnTo=/account/admin/users"])
    expect(safeAdminQueueReturn(unsafe)).toBeNull();
});
