export type Node = {
  id: string;
  customerId: string;
  parentId: string | null;
  kind: string;
  number: string;
  name: string;
  address: string;
  contact: string;
  usage: string;
  operatingHours: string;
  workingDays: string;
  shiftModel: string;
  productionHours: string;
  usableArea: number | null;
  heatedArea: number | null;
  year: number | null;
  heating: string;
  cooling: string;
  lighting: string;
  energySources: string;
  supplySystems: string;
  timeZone: string;
  assetType: string;
  assetRole: string;
  manufacturer: string;
  model: string;
  quantity: number;
  ratedPowerW: number;
  systemPowerW: number | null;
  annualHours: number;
  operatingDays: number;
  loadFactor: number;
  measuringPointId: string | null;
  notes: string;
  customFields: Record<string, string>;
  isActive: boolean;
  version: number;
};
export type NodeView = {
  node: Node;
  estimatedPowerKw: number | null;
  estimatedAnnualKwh: number | null;
};
export type Point = {
  id: string;
  customerId: string;
  number: string;
  name: string;
  medium: string;
  unit: string;
  quantity: string;
  direction: string;
  readingIntervalDays: number;
  maxDailyConsumption: number | null;
  supplier: string;
  tariffReference: string;
  notes: string;
  isActive: boolean;
  version: number;
};
export type Assignment = {
  id: string;
  pointId: string;
  siteId: string;
  nodeId: string;
  parentPointId: string | null;
  validFrom: string;
  validTo: string | null;
};
export type Device = {
  id: string;
  number: string;
  manufacturer: string;
  model: string;
  meterType: string;
};
export type Installation = {
  id: string;
  pointId: string;
  deviceId: string;
  factor: number;
  decimals: number;
  resolution: number;
  registerLimit: number | null;
  validFrom: string;
  validTo: string | null;
};
export type Reading = {
  id: string;
  installationId: string;
  at: string;
  value: number;
  status: string;
  comment: string;
  event: string;
  reason: string;
  isRollover: boolean;
  createdAt: string;
  version: number;
};
export type PointView = {
  point: Point;
  assignment: Assignment;
  installation: Installation;
  device: Device;
  latestReading: Reading | null;
};
export type Tree = { nodes: NodeView[]; points: PointView[] };
export type Document = {
  id: string;
  readingId?: string;
  name: string;
  contentType: string;
};
export type Detail = {
  point: Point;
  assignments: Assignment[];
  installations: Installation[];
  devices: Device[];
  readings: { reading: Reading; consumption: number | null }[];
  revisions: {
    id: string;
    readingId: string;
    before: string;
    after: string;
    at: string;
    reason: string;
  }[];
  replacements: {
    id: string;
    at: string;
    reason: string;
    isIncomplete: boolean;
  }[];
  documents: Document[];
};
export const kinds: Record<string, string> = {
  Site: 'Standort',
  Building: 'Gebäude',
  Area: 'Bereich / Anlage',
  Distribution: 'Verteilung',
  ConsumerGroup: 'Verbrauchergruppe',
  ConsumerAsset: 'Hardware / Verbraucher / Erzeuger',
};
export const media: Record<string, string> = {
  Electricity: 'Strom',
  Water: 'Wasser',
  Gas: 'Erdgas',
  Heat: 'Wärme',
  Cooling: 'Kälte',
};
export const units: Record<string, string[]> = {
  Electricity: ['kWh', 'MWh'],
  Water: ['m³'],
  Gas: ['m³', 'kWh'],
  Heat: ['kWh', 'MWh'],
  Cooling: ['kWh', 'MWh'],
};
export const events = [
  '',
  'Wartung',
  'Reparatur',
  'Produktionsstillstand',
  'Außergewöhnlicher Verbrauch',
  'Betriebsurlaub',
  'Technische Störung',
  'Sonstiges Ereignis',
];
export function localInput(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 19);
}
export const num = (value: number | null | undefined) =>
  value == null
    ? '–'
    : new Intl.NumberFormat('de-DE', { maximumFractionDigits: 6 }).format(
        value,
      );
export const emptyNode: Omit<Node, 'id' | 'customerId'> = {
  parentId: null,
  kind: 'Site',
  number: '',
  name: '',
  address: '',
  contact: '',
  usage: '',
  operatingHours: '',
  workingDays: '',
  shiftModel: '',
  productionHours: '',
  usableArea: null,
  heatedArea: null,
  year: null,
  heating: '',
  cooling: '',
  lighting: '',
  energySources: '',
  supplySystems: '',
  timeZone: 'Europe/Berlin',
  assetType: '',
  assetRole: 'Consumption',
  manufacturer: '',
  model: '',
  quantity: 1,
  ratedPowerW: 0,
  systemPowerW: null,
  annualHours: 0,
  operatingDays: 0,
  loadFactor: 1,
  measuringPointId: null,
  notes: '',
  customFields: {},
  isActive: true,
  version: 1,
};
