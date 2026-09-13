import { FAMILY_IPV4, FAMILY_IPV6 } from "ip-utilties";

export const PROTOCOL_TCP = "tcp";
export const PROTOCOL_UDP = "udp";
export const PROTOCOL_QUIC = "quic";

export const FAMILY_UNIX = "unix";
export const FAMILY_DNS = "dns";
export const FAMILY_IPV4_IPV6 = new Set([FAMILY_IPV4, FAMILY_IPV6]);

