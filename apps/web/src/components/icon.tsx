import {
  ArrowUpRight, Upload, Download, File, FileText, Image, Film,
  Archive, Plus, Check, Timer, Link, Copy, X, ShieldCheck, LockKeyhole, Trash2,
  CircleAlert, RefreshCw, LoaderCircle, Users, SendHorizontal, FolderDown, CloudUpload, CloudDownload, Badge, Menu,
} from "lucide-react";

const icons = {
  "arrow-up-right": ArrowUpRight, "arrow-right": SendHorizontal,
  "arrow-up": Upload, "arrow-down": Download, "file-download": FolderDown,
  plus: Plus, file: File, text: FileText, image: Image, video: Film, archive: Archive,
  check: Check, clock: Timer, link: Link, copy: Copy, x: X,
  shield: ShieldCheck, lock: LockKeyhole, trash: Trash2, alert: CircleAlert,
  refresh: RefreshCw, loader: LoaderCircle, users: Users, send: SendHorizontal, upload: CloudUpload,
  badge: Badge, "cloud-download": CloudDownload, menu: Menu,
};
export type IconName = keyof typeof icons;

export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  const Glyph = icons[name];
  return <Glyph size={20} strokeWidth={1.75} className={`shrink-0 align-middle ${className}`} aria-hidden="true" />;
}
