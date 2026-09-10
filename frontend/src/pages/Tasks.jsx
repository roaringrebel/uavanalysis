import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, CheckCircle, Clock, Circle, Filter } from 'lucide-react';
import { useEngineStore } from '../store/useEngineStore';

const PRIORITY_TAG = { high:'tag-high', medium:'tag-medium', low:'tag-low' };
const STATUS_ICON  = {
  open:        { icon: Circle,       cls: 'text-gray-400'  },
  'in-progress':{ icon: Clock,       cls: 'text-amber-500' },
  done:        { icon: CheckCircle,  cls: 'text-green-500' },
};

const FILTERS = ['all','open','in-progress','done'];

const Tasks = () => {
  const tasks       = useEngineStore(s => s.tasks);
  const setTaskStatus = useEngineStore(s => s.setTaskStatus);
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);
  const openCount = tasks.filter(t => t.status === 'open').length;
  const doneCount = tasks.filter(t => t.status === 'done').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label:'Total Tasks', val: tasks.length, cls:'text-gray-900' },
          { label:'Open',        val: openCount,    cls:'text-amber-600' },
          { label:'Completed',   val: doneCount,    cls:'text-green-600' },
        ].map(s => (
          <div key={s.label} className="card border border-gray-100 text-center py-4">
            <p className="label-xs mb-2">{s.label}</p>
            <p className={`text-2xl font-extrabold ${s.cls}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Filter + list */}
      <div className="card border border-gray-100">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-orange-500" />
            <h3 className="text-sm font-bold text-gray-800">All Maintenance Tasks</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <Filter size={13} className="text-gray-400" />
            {FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl border capitalize transition-all
                  ${filter === f ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center py-10 text-gray-400">
              <CheckCircle size={32} strokeWidth={1.5} />
              <p className="text-sm mt-2 font-medium">No tasks in this category</p>
            </div>
          )}
          {filtered.map(task => {
            const sc = STATUS_ICON[task.status] || STATUS_ICON.open;
            const StatusIcon = sc.icon;
            return (
              <div key={task.id}
                className="flex items-center gap-4 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors">
                <StatusIcon size={16} className={`shrink-0 ${sc.cls}`} strokeWidth={1.8} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold leading-snug ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {task.name}
                  </p>
                  <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                    <Clock size={9} strokeWidth={2} /> Due: {task.due}
                  </p>
                </div>
                <span className={PRIORITY_TAG[task.priority] || 'tag-low'}>
                  {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                </span>
                {/* Status toggle */}
                <select
                  value={task.status}
                  onChange={e => setTaskStatus(task.id, e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600 outline-none focus:border-orange-400 cursor-pointer"
                >
                  <option value="open">Open</option>
                  <option value="in-progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default Tasks;
