import test from "ava";
import { join } from "node:path";
import { Root, UnixEndpoint, ServiceTypes } from "pmcf";
import { OpenLDAPService } from "../src/services/openldap.mjs";

test("OpenLDAPService basics", async t => {
  const root = new Root(new URL("fixtures/root1", import.meta.url).pathname);
  await root.loadAll();

  const openldap = await root.named("/L1/host1/openldap");

  t.true(openldap instanceof OpenLDAPService);
  t.is(openldap.baseDN, "dc=mydomain,dc=com");
  t.is(openldap.rootDN, "dn=root,dc=mydomain,dc=com");
  t.is(openldap.uri, "ldap://");

  //console.log([...openldap.propertyIterator(filterConfigurable)]);

  t.deepEqual(
    openldap.endpoint("ldapi"),
    new UnixEndpoint(openldap, "/run/ldapi", {
      type: ServiceTypes.ldapi,
      scheme: "ldapi"
    })
  );

  t.deepEqual(
    openldap.endpoint("ldapi").url.toString(),
    new URL("ldapi:///run/ldapi").toString()
  );

  const r = new URL("fixtures/root1", import.meta.url).pathname;

  const packageDef = (
    await Array.fromAsync(openldap.preparePackages("/tmp"))
  )[0];

  //console.log(packageDef);

  const files = Object.fromEntries(
    (await Array.fromAsync(packageDef.sources[0])).map(entry => [
      entry.name,
      entry
    ])
  );

  t.truthy(files["var/lib/openldap/openldap-data/DB_CONFIG"]);
  t.truthy(files["etc/openldap/slapd.conf"]);

  //console.log(await files["etc/openldap/slapd.conf"].string);
  //console.log(Object.keys(files));

  /*
  for await(const file of packageDef.sources[0]) {
    console.log(file.name);
  }*/

  /*
  t.deepEqual(
    (await Array.fromAsync(openldap.preparePackages("/tmp")))
      .map(result => result.sources.map(source => source.base))
      .flat(),
    [
      join(r, "services/openldap/openldap/content"),
      join(r, "L1/host1/openldap/content"),
      "/tmp"
    ]
  );

  */
});
