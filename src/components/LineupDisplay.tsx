interface LineupMember {
  name: string;
  gen: string;
  photo: string;
}

interface LineupDisplayProps {
  lineup: LineupMember[];
}

const LineupDisplay = ({ lineup }: LineupDisplayProps) => {
  if (!lineup || lineup.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-foreground">🎤 Line Up</span>
        <span className="text-xs text-muted-foreground font-mono">{lineup.length} member</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {lineup.map((member) => (
          <div key={member.name} className="flex-shrink-0 w-16 text-center">
            <div className="w-14 h-14 mx-auto rounded-full overflow-hidden border-2 border-primary/30 mb-1">
              <img src={member.photo} alt={member.name} className="w-full h-full object-cover" loading="lazy" />
            </div>
            <p className="text-[10px] text-foreground font-medium truncate">{member.name}</p>
            <p className="text-[8px] text-muted-foreground">{member.gen}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LineupDisplay;
