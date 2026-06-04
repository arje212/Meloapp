import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function AchievementPopup({ achievement, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <AnimatePresence>
      {achievement && (
        <motion.div
          initial={{ opacity: 0, y: 80, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 80, scale: 0.8 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-80"
        >
          <div className="bg-card border-2 border-yellow-400 rounded-2xl shadow-2xl p-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shrink-0 shadow-lg">
              <span className="text-2xl">{achievement.icon || '🏆'}</span>
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-yellow-500 uppercase tracking-wide">Achievement Unlocked!</p>
              <p className="font-bold text-sm">{achievement.title}</p>
              <p className="text-xs text-muted-foreground">{achievement.description}</p>
              <p className="text-xs text-yellow-500 font-semibold mt-1">+{achievement.xp_earned} XP</p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}