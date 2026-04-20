import { User } from "lucide-react";

interface ChannelInfoProps {
  channelName: string;
  channelAvatar: string;
  channelAvatar2?: string;
  viewerCount: number;
  streamTitle: string;
}

const ChannelInfo = ({ channelName, channelAvatar, channelAvatar2, viewerCount, streamTitle }: ChannelInfoProps) => {
  const hasTwoLogos = Boolean(channelAvatar) && Boolean(channelAvatar2);

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-card rounded-lg border border-border">
      <div className="flex items-center flex-shrink-0">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-secondary flex items-center justify-center border-2 border-card z-10">
          {channelAvatar ? (
            <img src={channelAvatar} alt={channelName} className="w-full h-full object-cover" />
          ) : (
            <User size={20} className="text-muted-foreground" />
          )}
        </div>
        {hasTwoLogos && (
          <div className="w-10 h-10 rounded-full overflow-hidden bg-secondary flex items-center justify-center border-2 border-card -ml-3">
            <img src={channelAvatar2} alt={`${channelName} 2`} className="w-full h-full object-cover" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-foreground truncate">{channelName}</h2>
        </div>
        <p className="text-sm text-muted-foreground truncate">{streamTitle}</p>
      </div>
      <div className="flex items-center gap-1.5 bg-secondary px-3 py-1.5 rounded-full flex-shrink-0">
        <div className="w-2 h-2 bg-live rounded-full" style={{ animation: "pulse-live 1.5s infinite" }} />
        <span className="text-sm text-foreground font-mono">{viewerCount.toLocaleString()}</span>
        <span className="text-xs text-muted-foreground">penonton</span>
      </div>
    </div>
  );
};

export default ChannelInfo;
