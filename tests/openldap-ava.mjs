import test from "ava";
import { join } from "node:path";
import { InitializationContext, UnixEndpoint, ServiceTypes } from "pmcf";
import { openldap } from "../src/services/openldap.mjs";

test("OpenLDAPService basics", async t => {
  const ic = new InitializationContext(
    new URL("fixtures/root1", import.meta.url).pathname
  );
  await ic.loadAll();

  const openldapInst = ic.named("/L1/host1/openldap");

  t.true(openldapInst instanceof openldap);
  t.is(openldapInst.base, "dc=mydomain,dc=com");
  t.is(openldapInst.uri, "ldap://");

  t.deepEqual(
    openldapInst.endpoint("ldapi"),
    new UnixEndpoint(openldapInst, "/run/ldapi", {
      type: ServiceTypes.ldapi,
      scheme: "ldapi"
    })
  );

  t.deepEqual(
    openldapInst.endpoint("ldapi").url.toString(),
    new URL("ldapi:///run/ldapi").toString()
  );

  //const r = new URL("fixtures/root1", import.meta.url).pathname;

  const packageDef = (
    await Array.fromAsync(openldapInst.preparePackages("/tmp"))
  )[0];

  const sources = await Array.fromAsync(packageDef.sources);

  const files = Object.fromEntries(
    (await Array.fromAsync(sources[0])).map(entry => [entry.name, entry])
  );

  t.truthy(files["var/lib/openldap/openldap-data/DB_CONFIG"]);
  t.truthy(files["etc/openldap/slapd.conf"]);

  //console.log(await files["etc/openldap/slapd.conf"].string);
  //console.log(Object.keys(files));

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
