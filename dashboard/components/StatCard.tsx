type Props = {
  label: string;
  value: string | number;
  sub?: string;
};

export default function StatCard({ label, value, sub }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-0.5">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-gray-900 tabular-nums">{value}{sub && <span className="text-sm font-normal text-gray-400 ml-1">{sub}</span>}</span>
    </div>
  );
}
