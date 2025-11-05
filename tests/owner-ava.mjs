import test from "ava";
import { Root, Owner, Location, Network, Host, Cluster } from "pmcf";

function to(t, owner) {
  const types = { l1: Location, h1: Host, n1: Network, c1: Cluster };

  for (let [name, factory] of Object.entries(types)) {
    t.log(`${factory.typeName} factory`);
    const object = new factory(owner, { name });
    owner.addObject(object);

    name = object.fullName;

    t.is(object.owner, owner);
    t.deepEqual([...owner.typeList(factory.typeName)], [object]);
    t.is(owner.named(name), object);
    t.is(owner.typeNamed(factory.typeName, name), object);
  }
}

to.title = (title, owner) => `${title || "owner"} ${owner.fullName}`;

test(to, new Root("/tmp"));
test(to, new Owner(new Root("/tmp"), { name: "o1" }));

test("Owner ownerFor", t => {
  const root = new Root("/");
  const o1 = new Owner(root, { name: "o1" });
  root.addObject(o1);

  t.is(
    o1.ownerFor(Owner.typeDefinition.attributes.networks, { name: "n1" }),
    o1
  );
});

test("Owner read write", t => {
  const root = new Root("/");
  const o1 = new Owner(root);

  t.is(o1.owner, root);
  o1.read({
    name: "o1",
    administratorEmail: "master@somewhere",
    subnets: ["10.0.0.2/16", "fe80::1e57:3eff:fe22:9a8f/64"],
    networks: { n1: { kind: "ethernet" } }
  });

  root.addObject(o1);

  t.is(o1.name, "o1");
  t.is(o1.directory, "/o1");
  t.is(o1.administratorEmail, "master@somewhere");
  t.is(o1.subnetNamed("10.0/16").name, "10.0/16");
  t.is(o1.subnetNamed("fe80::/64").name, "fe80::/64");

  t.is(o1.networkNamed("n1").kind, "ethernet");

  t.deepEqual(o1.toJSON(), {
    name: "o1",
    directory: "/o1",
    owner: {
      type: "root"
    },
    administratorEmail: "master@somewhere",
    networks: {
      n1: {
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
          "10.0/16": {
            directory: "/o1/10.0/16",
            name: "10.0/16",
            owner: {
              name: "o1",
              type: "owner"
            },
            family: "IPv4",
            prefixLength: 16
          },
          "fe80::/64": {
            directory: "/o1/fe80::/64",
            family: "IPv6",
            name: "fe80::/64",
            owner: {
              name: "o1",
              type: "owner"
            },
            prefixLength: 64
          }
        }
      }
    },
    subnets: {
      "10.0/16": {
        directory: "/o1/10.0/16",
        family: "IPv4",
        name: "10.0/16",
        owner: {
          name: "o1",
          type: "owner"
        },
        prefixLength: 16
      },
      "fe80::/64": {
        directory: "/o1/fe80::/64",
        family: "IPv6",
        name: "fe80::/64",
        owner: {
          name: "o1",
          type: "owner"
        },
        prefixLength: 64
      }
    }
  });
});
