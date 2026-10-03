export function MobileTableToggle({ mode, onChange }: { mode: 'COMPACT' | 'TABLE'; onChange: (mode: 'COMPACT' | 'TABLE') => void }) {
  return <div className="no-print space-y-2 text-xs sm:hidden"><div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1" aria-label="Kiểu xem trên điện thoại">
    {(['COMPACT', 'TABLE'] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => onChange(value)} className={`flex-1 px-3 py-2 rounded-md font-semibold ${mode === value ? 'bg-teal-700 text-white' : 'text-slate-600'}`}>{value === 'COMPACT' ? 'Dạng gọn' : 'Dạng bảng'}</button>)}
  </div>{mode === 'TABLE' && <p className="text-[11px] text-slate-500">Vuốt ngang bảng để xem đủ các cột.</p>}</div>;
}
