import test from "ava";
import { Root, UnixEndpoint, ServiceTypes } from "pmcf";
import { OpenLDAPService } from "../src/services/openldap.mjs";

test("OpenLDAPService basics", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const openldap = await root.named("/L1/host1/openldap");

  t.true(openldap instanceof OpenLDAPService);
  t.is(openldap.baseDN, "abc");
  t.is(openldap.rootDN, "dn=root");
  t.is(openldap.uri, "ldap://");

  t.deepEqual(
    openldap.endpoint("ldap"),
    new UnixEndpoint(openldap, "/run/ldapi", { type: ServiceTypes.ldap })
  );

  /*
  t.deepEqual(
    openldap.endpoints('ldapi').map(e => {
      return {
        type: e.type,
        port: e.port,
        address: e.address
      };
    }),
    [
      {
        type: "ldap",
        address: "192.168.1.1",
        port: 636
      }
    ]
  );
*/
});
