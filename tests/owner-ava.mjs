import test from "ava";
import { Root, Owner, Location, Network, Host, Cluster } from "pmcf";

function testOwner(t, owner) {
  const types = { l1: Location, h1: Host, n1: Network, c1: Cluster };

  for (let [name, factory] of Object.entries(types)) {
    t.log(`${factory.typeName} factory`);
    const object = new factory(owner, { name });
    name = object.fullName;

    t.is(object.owner, owner);
    t.deepEqual([...owner.typeList(factory.typeName)], [object]);
    t.deepEqual([...owner[factory.pluralTypeName]()], [object]);
    t.is(owner.named(name), object);
    t.is(owner[factory.nameLookupName](name), object);
    t.is(owner.typeNamed(factory.typeName, name), object);
  }
}

test("Owner level 1", t => testOwner(t, new Root("/tmp")));
test("Owner level 2", t => testOwner(t, new Owner(new Root("/tmp"), { name: "o1" })));
