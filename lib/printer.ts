import { isIPv4 } from 'node:net';
import type { FFPrinterDetail } from '@ghosttypes/ff-api';
import { normalize, type Snapshot } from './status';
export async function readPrinter(): Promise<Snapshot> {
 const checkedAt = new Date().toISOString();
 const result = (connection: Snapshot['connection'], message: string, data: Snapshot['data'] = null): Snapshot => ({connection,message,checkedAt,data});
 const ip = process.env.PRINTER_IP, serial = process.env.PRINTER_SERIAL, code = process.env.PRINTER_CHECK_CODE;
 if (!ip || !serial || !code) return result('unconfigured','Enter the printer IP, serial number and LAN check code in .env.local, then restart the app.');
 const port = Number(process.env.PRINTER_PORT || 8898);
 if (!isIPv4(ip) || !Number.isInteger(port) || port < 1 || port > 65535) return result('invalid','Check PRINTER_IP (IPv4 address) and PRINTER_PORT.');
 try {
  const response = await fetch(`http://${ip}:${port}/detail`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({serialNumber:serial,checkCode:code}),signal:AbortSignal.timeout(5000),cache:'no-store'});
  if (!response.ok) return result('offline','Printer rejected the request. Check LAN mode and credentials.');
  const body = await response.json();
  if (!body || typeof body.detail !== 'object' || !body.detail || Array.isArray(body.detail) || typeof body.detail.status !== 'string') return result('offline','No valid printer status received. Check the serial number, check code and firmware.');
  return result('online','Connected over LAN',normalize(body.detail as FFPrinterDetail));
 } catch { return result('offline','Printer unavailable. Check power, LAN mode and that this Mac is on the same network. Retrying automatically.'); }
}
