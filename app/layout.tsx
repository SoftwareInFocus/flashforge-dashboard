import './globals.css';
import {DashboardNav} from '../components/DashboardNav';
export const metadata = { title: 'Personal dashboard', description: 'Local printer monitoring and daily social scout' };
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="en"><body><DashboardNav/><div className="dashboard-shell">{children}</div></body></html>}
