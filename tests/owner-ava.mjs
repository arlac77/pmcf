import test from "ava";
import { FAMILY_IPV4, FAMILY_IPV6 } from "ip-utilties";
import { Owner, assign, owners_attribute } from "pmcf";
import { InitializationContext } from "../src/initialization-context.mjs";

test("Owner read write", t => {
  const ic = new InitializationContext();

  t.is(ic.root.directory, "/");

  const o1 = new Owner();

  assign(owners_attribute, ic.root, o1);

  t.is(o1.owner, ic.root);

  ic.read(o1, {
    name: "o1",
    subnets: ["10.0.0.2/16"],
    administratorEmail: "master@somewhere",
    networks: { n1: { kind: "ethernet" } },
    template: true
  });

  t.is(o1.owner, ic.root);

  t.is(o1.isTemplate, true);
  t.is(o1.name, "o1");
  t.is(o1.directory, "/o1");
  t.is(o1.administratorEmail, "master@somewhere");
  t.is(o1.subnets.get("10.0/16").name, "10.0/16");

  t.is(o1.networks.get("n1").kind, "ethernet");

  t.deepEqual(o1.toJSON(), {
    name: "o1",
    directory: "/o1",
    owner: {
      name: "",
      type: "root"
    },
    administratorEmail: "master@somewhere",
    networks: {
      n1: {
        name: "n1",
        administratorEmail: "master@somewhere",
        directory: "/o1/n1",
        kind: "ethernet",
        mtu: 1500,
        secretName: "n1.password",
        owner: {
          name: "o1",
          type: "owner"
        },
        subnets: {
          "fe80::/64": {
            family: FAMILY_IPV6,
            prefixLength: 64
          }
        }
      }
    },
    subnets: {
      "10.0/16": {
        family: FAMILY_IPV4,
        prefixLength: 16
      }
    }
  });
});
