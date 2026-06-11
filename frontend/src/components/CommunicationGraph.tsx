import { useEffect, useMemo, useRef } from 'react';
import cytoscape from 'cytoscape';
import type { Asset, Flow } from '@soc/telemetry-shared';
import { assetLabel, protocolTone } from '../lib/telemetry';

interface CommunicationGraphProps {
  assets: Asset[];
  flows: Flow[];
  selectedIp: string | null;
  onSelectIp: (ip: string) => void;
}

export function CommunicationGraph({ assets, flows, selectedIp, onSelectIp }: CommunicationGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<any>(null);

  const elements = useMemo(() => {
    const nodes = assets.map((asset) => ({
      data: {
        id: asset.ip,
        label: assetLabel(asset),
        ip: asset.ip,
        hostname: asset.hostname ?? asset.ip,
        volume: asset.communicationVolume,
        color: selectedIp === asset.ip ? '#ffb84d' : '#4cc9f0'
      }
    }));

    const edges = flows.map((flow) => ({
      data: {
        id: flow.id,
        source: flow.src_ip,
        target: flow.dst_ip,
        label: `${flow.protocol ?? 'FLOW'} ${flow.bytes.toLocaleString()}B`,
        bytes: flow.bytes,
        protocol: flow.protocol,
        color: protocolTone(flow.protocol),
        risk: flow.risk_score ?? 0
      }
    }));

    return [...nodes, ...edges];
  }, [assets, flows, selectedIp]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'core',
          style: {
            'selection-box-color': '#4cc9f0',
            'selection-box-opacity': 0.15
          }
        },
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'border-color': '#0a1524',
            'border-width': 2,
            label: 'data(label)',
            color: '#e7eefb',
            'font-size': 10,
            'text-wrap': 'wrap',
            'text-max-width': '90',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            width: 'mapData(volume, 0, 600000, 28, 80)',
            height: 'mapData(volume, 0, 600000, 28, 80)',
            'overlay-padding': 8,
          }
        },
        {
          selector: 'edge',
          style: {
            width: 'mapData(bytes, 0, 200000, 1, 12)',
            'line-color': 'data(color)',
            'target-arrow-color': 'data(color)',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            color: '#9fb2d0',
            'font-size': 8,
            'text-background-color': '#07111f',
            'text-background-opacity': 0.78,
            'text-background-padding': '3',
            'text-rotation': 'autorotate',
            opacity: 0.82
          }
        },
        {
          selector: '.highlighted',
          style: {
            'border-width': 4,
            'border-color': '#ffb84d',
            'z-index': 10
          }
        },
        {
          selector: '.faded',
          style: {
            opacity: 0.18
          }
        }
      ],
      layout: {
        name: 'cose',
        animate: false,
        randomize: true,
        idealEdgeLength: 130,
        nodeRepulsion: 12000,
        nodeOverlap: 18,
        gravity: 0.2,
        fit: true,
        padding: 40
      }
    } as any);

    requestAnimationFrame(() => {
      cy.resize();
      cy.fit(undefined, 40);
    });

    cy.on('tap', 'node', (event) => {
      onSelectIp(event.target.data('ip'));
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [elements, onSelectIp]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    cy.elements().removeClass('highlighted faded');

    if (selectedIp) {
      const focused = cy.$id(selectedIp);
      if (focused.nonempty()) {
        focused.addClass('highlighted');
        focused.connectedEdges().addClass('highlighted');
        cy.elements().difference(focused.closedNeighborhood()).addClass('faded');
      }
    }
  }, [selectedIp, elements]);

  return <div className="graph-canvas" ref={containerRef} />;
}
