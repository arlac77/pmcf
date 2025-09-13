import test from "ava";
import {
  Base,
  Cluster,
  Root,
  Host,
  Location,
  Network,
  Service,
  Subnet,
  Owner,
  BindService,
  ChronyService,
  types,
  resolveTypeLinks
} from "pmcf";

test("types", t => {
  resolveTypeLinks();
  t.is(types.base.clazz, Base);
  t.is(types.root.clazz, Root);
  t.is(types.location.clazz, Location);
  t.deepEqual(types.location.owners, [types.owner, types.location, types.root]);

  t.is(types.network.clazz, Network);
  t.is(types.subnet.clazz, Subnet);
  t.is(types.service.clazz, Service);
  t.deepEqual(types.service.owners, [types.host, types.cluster, types.network_interface]);
  t.is(types.host.clazz, Host);
  t.deepEqual(types.host.owners, [types.owner, types.network, types.root]);

  t.is(types.bind.clazz, BindService);
  t.is(types.chrony.clazz, ChronyService);

  t.is(types.cluster.clazz, Cluster);
  t.is(types.owner.clazz, Owner);

  t.deepEqual(types.owner.extends, types.base);
  t.deepEqual(types.owner.identifier, types.base.attributes.name);
  t.deepEqual(types.service.extends, types.base);
  t.deepEqual(types.host.extends, types.base);
  t.deepEqual(types.cluster.extends, types.host);
  t.deepEqual(types.subnet.identifier, types.subnet.attributes.address);

  t.deepEqual(types.owner.attributes.hosts.type, [types.host]);
  t.deepEqual(types.owner.attributes.networks.type, [types.network]);
});
