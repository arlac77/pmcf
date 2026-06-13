import test from "ava";
import { types, resolveTypeLinks } from "pacc";
import {
  Base,
  Cluster,
  Root,
  Host,
  Location,
  Network,
  Service,
  ExtraSourceService,
  Subnet,
  Owner,
  bind,
  chrony,
  alpm
} from "pmcf";

test("types", t => {
  resolveTypeLinks();
  t.is(types.base, Base);
  t.is(types.base.extends, undefined);
  t.is(types.base.key, "name");

  t.is(types.owner, Owner);
  t.is(types.owner.extends, Base);
  t.is(types.owner.priority, 2);
  t.is(types.owner.key, "name");

  t.is(types.root, Root);
  t.is(types.root.extends, Location);
  t.is(types.root.priority, 3);
  t.is(types.location, Location);
  t.is(types.location.extends, Owner);
  t.is(types.location.priority, 2);
  t.is(types.location.key, "name");
  t.deepEqual(types.location.owners, [types.owner, types.location, types.root]);

  t.is(types.network, Network);
  t.is(types.network.extends, Owner);
  t.is(types.network.priority, 2);
  t.is(types.network.key, "name");

  t.is(types.subnet, Subnet);
  t.is(types.subnet.extends, Base);
  t.is(types.subnet.priority, 1);
  t.is(types.subnet.key, "address");

  t.is(types.service, Service);
  t.is(types.service.extends, Base);
  t.deepEqual(types.service.extends, types.base);
  t.deepEqual(types.service.owners, [
    Host,
    Cluster,
    types["network_interface"]
  ]);
  t.is(types.service.priority, 1.1);
  t.is(types.service.key, "name");
  /*
  t.deepEqual(types.service.owners, [
    types.host,
    types.cluster,
    types.network_interface
  ]);
  */
  t.is(types.host, Host);
  t.deepEqual(types.host.owners, [types.owner, types.network, types.root]);

  t.is(types.bind, bind);
  t.is(types.bind.extends, ExtraSourceService);
  t.is(types.bind.priority, 1.1);

  t.is(types.chrony, chrony);
  t.is(types.chrony.extends, ExtraSourceService);
  t.is(types.chrony.priority, 1.1);

  t.is(types.alpm, alpm);
  t.is(types.alpm.extends, Service);
  t.is(types.alpm.priority, 1.1);

  t.is(types.cluster, Cluster);
  t.is(types.cluster.extends, Host);
  t.is(types.cluster.priority, 1.5);

  t.deepEqual(types.owner.attributes.hosts.type, types.host);
  t.deepEqual(types.owner.attributes.networks.type, types.network);

  t.deepEqual(types.owner.extends, types.base);
  t.deepEqual(types.owner.key, "name");
  t.deepEqual(types.host.extends, types["service-owner"]);

  //console.log("CLUSTER EXT", types.cluster.extends.name, types.host.name);
  //t.is(types.cluster.extends, types.host);

  t.is(types.loopback.extends, types.SkeletonNetworkInterface);
});
