import type { TimeOfDay } from '../environment';
import type { Species } from './models';
export type Activity = 'forage' | 'patrol' | 'rest' | 'roost';
interface Routine { activity: Activity; pace: number; range: number }
// These are expressive island routines, not a wildlife simulation.
export const routines: Record<Species, Record<TimeOfDay, Routine>> = {
  rabbit: {day:{activity:'forage',pace:1,range:1},sunset:{activity:'forage',pace:1.4,range:1.3},night:{activity:'rest',pace:1,range:1}},
  fox: {day:{activity:'rest',pace:1,range:1},sunset:{activity:'patrol',pace:1.15,range:1.5},night:{activity:'patrol',pace:1.35,range:2}},
  bird: {day:{activity:'forage',pace:1,range:1},sunset:{activity:'roost',pace:1,range:1},night:{activity:'roost',pace:1,range:1}},
  gull: {day:{activity:'forage',pace:1,range:1},sunset:{activity:'rest',pace:1,range:1},night:{activity:'rest',pace:1,range:1}},
  butterfly: {day:{activity:'forage',pace:1,range:1},sunset:{activity:'rest',pace:1,range:1},night:{activity:'rest',pace:1,range:1}},
  crab: {day:{activity:'forage',pace:.8,range:1},sunset:{activity:'forage',pace:1.5,range:1.4},night:{activity:'forage',pace:1.2,range:1.2}},
  isopod: {day:{activity:'rest',pace:1,range:1},sunset:{activity:'forage',pace:1.5,range:1.4},night:{activity:'forage',pace:1.8,range:1.5}},
};
export const activityNames: Record<Activity,string> = {forage:'觅食',patrol:'巡游',rest:'休息',roost:'归巢'};
