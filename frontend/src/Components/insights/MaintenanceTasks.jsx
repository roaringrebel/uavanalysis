import React from 'react';
import { Wrench, Clock } from 'lucide-react';
import { useEngineStore } from '../../store/useEngineStore';

const PRIORITY_TAG = {
  high:   'tag-high',
  medium: 'tag-medium',
  low:    'tag-low',
};

const MaintenanceTasks = () => {
  const tasks = useEngineStore(s => s.tasks);

  return (
    <div className="card border border-gray-100 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
            <Wrench size={13} className="text-blue-500" strokeWidth={1.8} />
          </div>
          <h3 className="text-sm font-bold text-gray-800">Maintenance Tasks</h3>
        </div>
        <span className="label-xs">{tasks.length} tasks</span>
      </div>

      <div className="space-y-2">
        {tasks.slice(0, 4).map(task => (
          <div key={task.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
            <div className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
              <Wrench size={11} className="text-gray-400" strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-700 truncate">{task.name}</p>
              <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                <Clock size={9} strokeWidth={2} />
                Due: {task.due}
              </p>
            </div>
            <span className={PRIORITY_TAG[task.priority] || 'tag-low'}>
              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
            </span>
          </div>
        ))}
      </div>

      <button className="text-xs text-orange-500 font-semibold hover:text-orange-600 transition-colors text-left">
        View all tasks →
      </button>
    </div>
  );
};

export default MaintenanceTasks;
