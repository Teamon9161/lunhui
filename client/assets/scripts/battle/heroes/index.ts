import type { HeroDef } from '../defs';
import { NEZHA } from './nezha';
import { WUKONG } from './wukong';
import { ZHONGKUI } from './zhongkui';
import { JINGWEI } from './jingwei';
import { TANGSENG } from './tangseng';

export const HEROES: Record<string, HeroDef> = {
    nezha: NEZHA,
    wukong: WUKONG,
    zhongkui: ZHONGKUI,
    jingwei: JINGWEI,
    tangseng: TANGSENG,
};
