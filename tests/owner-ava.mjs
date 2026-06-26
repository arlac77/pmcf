import test from "ava";
import { FAMILY_IPV4, FAMILY_IPV6 } from "ip-utilties";
import {
  root,
  Owner,
  Network,
  Host,
  Cluster,
  assign,
  owners_attribute,
  networks_attribute
} from "pmcf";
import { InitializationContext } from "../src/initialization-context.mjs";

function to(t, owner) {
  const types = { l1: Owner, h1: Host, n1: Network, c1: Cluster };

  for (let [name, factory] of Object.entries(types)) {
    t.log(`${factory.typeName} factory`);
    const object = new factory(owner, { name });

    name = object.fullName;

    t.is(object.owner, owner);
    t.deepEqual([...owner.typeList(factory.typeName)], [object]);
    t.is(owner.named(name), object);
  }
}

to.title = (title, owner) => `${title || "owner"} ${owner.fullName}`;

test.skip("Root", to, new root("/tmp"));
test.skip("Owner", to, new Owner(new root("/tmp"), { name: "o1" }));

test("Owner ownerFor", t => {
  const ic = new InitializationContext();

  const o1 = new Owner();
  ic.read(o1, { name: "o1" });
  assign(owners_attribute, ic.root, o1);

  t.is(o1.ownerFor(networks_attribute, { name: "n1" }), o1);
});

test("Owner read write", t => {
  const ic = new InitializationContext();
  const o1 = new Owner();

  assign(owners_attribute, ic.root, o1);

  t.is(o1.owner, ic.root);
  ic.read(o1, {
    name: "o1",
    administratorEmail: "master@somewhere",
    subnets: ["10.0.0.2/16", "fe80::1e57:3eff:fe22:9a8f/64"],
    networks: { n1: { kind: "ethernet" } },
    template: true
  });

  t.is(o1.isTemplate, true);
  t.is(o1.name, "o1");
  t.is(o1.directory, "/o1");
  t.is(o1.administratorEmail, "master@somewhere");
  t.is(
    o1.subnets.values().find(subnet => subnet.name === "10.0/16").name,
    "10.0/16"
  );
  t.is(
    o1.subnets.values().find(subnet => subnet.name === "fe80::/64").name,
    "fe80::/64"
  );

  t.is(o1.networks.get("n1").kind, "ethernet");

  t.deepEqual(o1.toJSON(), {
    name: "o1",
    directory: "/o1",
    owner: {
      type: "root"
    },
    administratorEmail: "master@somewhere",
    networks: [
      {
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
        subnets: [
          {
            address: "10.0/16",
            directory: "/o1/10.0/16",
            family: FAMILY_IPV4,
            name: "10.0/16",
            owner: {
              name: "o1",
              type: "owner"
            },
            prefixLength: 16
          },
          {
            address: "fe80::/64",
            directory: "/o1/fe80::/64",
            family: FAMILY_IPV6,
            name: "fe80::/64",
            owner: {
              name: "o1",
              type: "owner"
            },
            prefixLength: 64
          }
        ]
      }
    ],
    subnets: [
      {
        address: "10.0/16",
        directory: "/o1/10.0/16",
        family: FAMILY_IPV4,
        name: "10.0/16",
        owner: {
          name: "o1",
          type: "owner"
        },
        prefixLength: 16
      },
      {
        address: "fe80::/64",
        directory: "/o1/fe80::/64",
        family: FAMILY_IPV6,
        name: "fe80::/64",
        owner: {
          name: "o1",
          type: "owner"
        },
        prefixLength: 64
      }
    ]
  });
});
