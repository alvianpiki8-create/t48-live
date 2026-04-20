import { ExternalLink } from "lucide-react";

const OrderShowBanner = () => {
  return (
    <a
      href="https://t48.lovable.app"
      target="_blank"
      rel="noreferrer"
      className="block bg-gradient-to-r from-primary/20 to-accent/30 border border-primary/30 rounded-xl p-4 hover:border-primary/50 transition-all group"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-foreground font-bold text-sm">Order show di sini👆</h3>
          <p className="text-muted-foreground text-xs mt-1">
            Order show lainnya di sini
          </p>
        </div>
        <div className="p-2 rounded-lg bg-primary/20 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
          <ExternalLink size={18} />
        </div>
      </div>
    </a>
  );
};

export default OrderShowBanner;
