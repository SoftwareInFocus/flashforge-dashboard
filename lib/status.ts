import type { FFPrinterDetail } from '@ghosttypes/ff-api';
const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
const string = (v: unknown) => typeof v === 'string' && v.trim() ? v : null;
export function normalize(d: FFPrinterDetail) {
 const progress = number(d.printProgress);
 return { name: string(d.name) ?? 'FlashForge AD5X', status: string(d.status) ?? 'unknown', error: string(d.errorCode),
 file: string(d.printFileName), progress: progress === null ? null : Math.min(100, progress * 100),
 layer: number(d.printLayer), layers: number(d.targetPrintLayer), elapsed: number(d.printDuration), remaining: number(d.estimatedTime),
 nozzle: {current:number(d.rightTemp),target:number(d.rightTargetTemp)}, bed:{current:number(d.platTemp),target:number(d.platTargetTemp)},
 slots: Array.isArray(d.matlStationInfo?.slotInfos) ? d.matlStationInfo.slotInfos.map(s => ({id:number(s.slotId), material:string(s.materialName), color: typeof s.materialColor === 'string' && /^#[0-9a-f]{6}$/i.test(s.materialColor) ? s.materialColor : '#777777', loaded: typeof s.hasFilament === 'boolean' ? s.hasFilament : null, active:s.slotId === d.matlStationInfo?.currentSlot})) : null };
}
export type PrinterStatus = ReturnType<typeof normalize>;
export type Snapshot = { connection: 'online' | 'offline' | 'unconfigured' | 'invalid'; message: string; checkedAt: string; data: PrinterStatus | null };
