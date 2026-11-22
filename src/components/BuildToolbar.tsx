import React, { useState } from 'react';
import {
  MousePointer2,
  Footprints,
  Coffee,
  Armchair,
  Flower2,
  ShoppingBag,
  Droplets,
  Bath,
  Home,
  Trash2,
  Award,
  Lock,
} from 'lucide-react';
import { FACILITY_COSTS, FLOOR_TYPE_LIST, FLOOR_TYPES, SPECIES_LIST } from '../data/zooCatalog';
import { BuildTool, FloorType } from '../types/zoo';
import { AnimalSprite } from './AnimalSprite';

interface BuildToolbarProps {
  activeTool: BuildTool;
  funds: number;
  landmarkUnlocked: boolean;
  discoveredVisitorCount: number;
  totalVisitorTypes: number;
  onSelectTool: (tool: BuildTool) => void;
}

export const BuildToolbar: React.FC<BuildToolbarProps> = ({
  activeTool,
  funds,
  landmarkUnlocked,
  discoveredVisitorCount,
  totalVisitorTypes,
  onSelectTool,
}) => {
  const [tab, setTab] = useState<'zones' | 'floors' | 'facilities'>('zones');
  const [lastFloor, setLastFloor] = useState<FloorType>('stone');

  const handleSelectFloor = (ft: FloorType) => {
    setLastFloor(ft);
    onSelectTool(`floor_${ft}`);
  };

  const facilityTools: Array<{
    id: BuildTool;
    label: string;
    cost: number | null;
    icon: React.ReactNode;
    shortcut: string;
  }> = [
    {
      id: 'select',
      label: '選取查看',
      cost: null,
      icon: <MousePointer2 className="w-4 h-4" />,
      shortcut: '1',
    },
    {
      id: 'snack',
      label: '輕食攤位',
      cost: FACILITY_COSTS.snack,
      icon: <Coffee className="w-4 h-4 text-orange-700" />,
      shortcut: '3',
    },
    {
      id: 'bench',
      label: '休憩長椅',
      cost: FACILITY_COSTS.bench,
      icon: <Armchair className="w-4 h-4 text-stone-700" />,
      shortcut: '4',
    },
    {
      id: 'garden',
      label: '觀景花圃',
      cost: FACILITY_COSTS.garden,
      icon: <Flower2 className="w-4 h-4 text-rose-600" />,
      shortcut: '5',
    },
    {
      id: 'souvenir',
      label: '紀念品商店',
      cost: FACILITY_COSTS.souvenir,
      icon: <ShoppingBag className="w-4 h-4 text-amber-700" />,
      shortcut: '6',
    },
    {
      id: 'fountain',
      label: '噴泉廣場',
      cost: FACILITY_COSTS.fountain,
      icon: <Droplets className="w-4 h-4 text-sky-600" />,
      shortcut: '7',
    },
    {
      id: 'restroom',
      label: '園區洗手間',
      cost: FACILITY_COSTS.restroom,
      icon: <Bath className="w-4 h-4 text-teal-700" />,
      shortcut: '8',
    },
    {
      id: 'pavilion',
      label: '觀景涼亭',
      cost: FACILITY_COSTS.pavilion,
      icon: <Home className="w-4 h-4 text-emerald-700" />,
      shortcut: '9',
    },
    {
      id: 'landmark',
      label: '金色導覽地標',
      cost: FACILITY_COSTS.landmark,
      icon: landmarkUnlocked ? (
        <Award className="w-4 h-4 text-amber-500" />
      ) : (
        <Lock className="w-4 h-4 text-[#8A988E]" />
      ),
      shortcut: 'L',
    },
    {
      id: 'demolish',
      label: '拆除退費',
      cost: null,
      icon: <Trash2 className="w-4 h-4 text-rose-600" />,
      shortcut: '0',
    },
  ];

  const activeFloorType: FloorType | null = activeTool.startsWith('floor_')
    ? (activeTool.replace('floor_', '') as FloorType)
    : null;
  const quickFloorSpec = FLOOR_TYPES[activeFloorType ?? lastFloor];

  return (
    <div className="bg-white border border-[#E2DDD3] rounded-xl p-2.5 flex flex-col gap-2 shadow-xs">
      {/* Top Row: Quick Actions + Category Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 p-0.5 bg-[#F4F2EC] rounded-lg border border-[#E2DDD3]">
          <button
            type="button"
            onClick={() => setTab('zones')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'zones'
                ? 'bg-white text-[#1A2B20] shadow-xs'
                : 'text-[#5B6D60] hover:text-[#1A2B20]'
            }`}
          >
            動物專屬區 ({SPECIES_LIST.length}種)
          </button>
          <button
            type="button"
            onClick={() => setTab('floors')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'floors'
                ? 'bg-white text-[#1A2B20] shadow-xs'
                : 'text-[#5B6D60] hover:text-[#1A2B20]'
            }`}
          >
            園區地板 (5種)
          </button>
          <button
            type="button"
            onClick={() => setTab('facilities')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              tab === 'facilities'
                ? 'bg-white text-[#1A2B20] shadow-xs'
                : 'text-[#5B6D60] hover:text-[#1A2B20]'
            }`}
          >
            <span>園區設施 (8種)</span>
            {landmarkUnlocked && (
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                地標已解鎖
              </span>
            )}
          </button>
        </div>

        {/* Always-accessible core tools */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSelectTool('select')}
            title="快捷鍵 1"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors whitespace-nowrap cursor-pointer ${
              activeTool === 'select'
                ? 'bg-[#1A2B20] text-white border-[#1A2B20]'
                : 'bg-[#FAF9F5] text-[#1A2B20] border-[#E2DDD3] hover:border-[#C7BFB0]'
            }`}
          >
            <MousePointer2 className={`w-4 h-4 ${activeTool === 'select' ? 'text-emerald-300' : ''}`} />
            <span>選取查看</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectTool(`floor_${activeFloorType ?? lastFloor}`);
              setTab('floors');
            }}
            title="快捷鍵 2 · Shift+拖曳連續鋪設"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors whitespace-nowrap cursor-pointer ${
              activeFloorType !== null
                ? 'bg-[#1A2B20] text-white border-[#1A2B20]'
                : 'bg-[#FAF9F5] text-[#1A2B20] border-[#E2DDD3] hover:border-[#C7BFB0]'
            }`}
          >
            <Footprints className={`w-4 h-4 ${activeFloorType !== null ? 'text-emerald-300' : ''}`} />
            <span>{quickFloorSpec.name}</span>
            <span className={`font-mono-num text-[11px] ${activeFloorType !== null ? 'text-stone-300' : 'text-[#5B6D60]'}`}>
              ${quickFloorSpec.cost}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTool('demolish')}
            title="快捷鍵 0"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors whitespace-nowrap cursor-pointer ${
              activeTool === 'demolish'
                ? 'bg-[#1A2B20] text-white border-[#1A2B20]'
                : 'bg-[#FAF9F5] text-[#1A2B20] border-[#E2DDD3] hover:border-[#C7BFB0]'
            }`}
          >
            <Trash2 className={`w-4 h-4 ${activeTool === 'demolish' ? 'text-emerald-300' : 'text-rose-600'}`} />
            <span>拆除退費</span>
          </button>
        </div>
      </div>

      {/* Bottom Row: Selected Tab Items */}
      {tab === 'zones' ? (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#EFECE3]">
          {SPECIES_LIST.map((spec) => {
            const toolId: BuildTool = `zone_${spec.id}`;
            const isActive = activeTool === toolId;
            const cantAfford = funds < spec.buildCost;
            return (
              <button
                key={spec.id}
                type="button"
                onClick={() => onSelectTool(toolId)}
                title={spec.description}
                className={`px-2 py-1.5 rounded-lg text-left transition-colors flex items-center gap-1.5 border cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-[#1A2B20] text-white border-[#1A2B20]'
                    : 'bg-[#FAF9F5] text-[#1A2B20] border-transparent hover:border-[#D5CFC2]'
                } ${cantAfford && !isActive ? 'opacity-60' : ''}`}
              >
                <AnimalSprite speciesId={spec.id} size={20} />
                <div className="flex flex-col leading-none">
                  <span className="text-[11px] font-semibold whitespace-nowrap">
                    {spec.zoneShortName}
                  </span>
                  <span
                    className={`font-mono-num text-[10px] mt-0.5 whitespace-nowrap ${
                      isActive
                        ? 'text-stone-300'
                        : cantAfford
                        ? 'text-rose-600 font-semibold'
                        : 'text-[#6A7B6F]'
                    }`}
                  >
                    ${spec.buildCost}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : tab === 'floors' ? (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#EFECE3]">
          {FLOOR_TYPE_LIST.map((fl) => {
            const toolId: BuildTool = `floor_${fl.id}`;
            const isActive = activeTool === toolId;
            const cantAfford = funds < fl.cost;
            return (
              <button
                key={fl.id}
                type="button"
                onClick={() => handleSelectFloor(fl.id)}
                title={fl.description}
                className={`px-3 py-2 rounded-lg text-left transition-colors flex items-center gap-2.5 border cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-[#1A2B20] text-white border-[#1A2B20]'
                    : 'bg-[#FAF9F5] text-[#1A2B20] border-transparent hover:border-[#D5CFC2]'
                } ${cantAfford && !isActive ? 'opacity-60' : ''}`}
              >
                <span
                  className="w-5 h-5 rounded-md border border-black/15 shrink-0 shadow-inner"
                  style={{ backgroundColor: fl.swatchColor }}
                />
                <div className="flex flex-col leading-none">
                  <span className="text-xs font-semibold whitespace-nowrap">{fl.name}</span>
                  <span
                    className={`font-mono-num text-[11px] mt-1 whitespace-nowrap ${
                      isActive
                        ? 'text-stone-300'
                        : cantAfford
                        ? 'text-rose-600 font-semibold'
                        : 'text-[#6A7B6F]'
                    }`}
                  >
                    ${fl.cost} · Shift+拖曳
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#EFECE3]">
          {facilityTools.map((tool) => {
            const isLandmark = tool.id === 'landmark';
            const isLocked = isLandmark && !landmarkUnlocked;
            const isActive = activeTool === tool.id;
            const cantAfford = tool.cost !== null && funds < tool.cost;
            return (
              <button
                key={tool.id}
                type="button"
                disabled={isLocked}
                onClick={() => {
                  if (!isLocked) onSelectTool(tool.id);
                }}
                title={
                  isLocked
                    ? `接待全部 ${totalVisitorTypes} 種遊客類型即可解鎖（目前 ${discoveredVisitorCount}/${totalVisitorTypes}）`
                    : isLandmark
                    ? `快捷鍵 ${tool.shortcut} · 增加園區魅力 +${FACILITY_COSTS.landmarkAppeal} 並提升鄰近展區吸引力`
                    : `快捷鍵 ${tool.shortcut}`
                }
                className={`px-3 py-2 rounded-lg text-left transition-colors flex items-center gap-2 border shrink-0 ${
                  isLocked
                    ? 'bg-[#F4F2EC] text-[#8A988E] border-[#E2DDD3] opacity-75 cursor-not-allowed'
                    : isActive
                    ? 'bg-[#1A2B20] text-white border-[#1A2B20] cursor-pointer'
                    : isLandmark
                    ? 'bg-amber-50 text-[#1A2B20] border-amber-300 hover:border-amber-400 cursor-pointer'
                    : 'bg-[#FAF9F5] text-[#1A2B20] border-transparent hover:border-[#D5CFC2] cursor-pointer'
                } ${!isLocked && cantAfford && !isActive ? 'opacity-60' : ''}`}
              >
                <span className={isActive ? 'text-emerald-300' : ''}>{tool.icon}</span>
                <div className="flex flex-col leading-none">
                  <span className="text-xs font-semibold whitespace-nowrap">{tool.label}</span>
                  <span
                    className={`font-mono-num text-[11px] mt-1 whitespace-nowrap ${
                      isLocked
                        ? 'text-[#7A8A7E]'
                        : isActive
                        ? 'text-stone-300'
                        : cantAfford
                        ? 'text-rose-600 font-semibold'
                        : isLandmark
                        ? 'text-amber-700 font-semibold'
                        : 'text-[#6A7B6F]'
                    }`}
                  >
                    {isLocked
                      ? `未解鎖 ${discoveredVisitorCount}/${totalVisitorTypes}`
                      : isLandmark
                      ? `$${tool.cost} · +${FACILITY_COSTS.landmarkAppeal}魅力`
                      : tool.cost !== null
                      ? `$${tool.cost}`
                      : tool.id === 'demolish'
                      ? '退半價'
                      : '檢視'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
