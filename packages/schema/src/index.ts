import { z } from 'zod';

const nodeBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string(),
  parentId: z.string().nullable(),
  locked: z.boolean(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.number(),
  scaleX: z.number(),
  scaleY: z.number(),
  opacity: z.number().min(0).max(1),
  visible: z.boolean(),
  fill: z.string().nullable(),
  fillOpacity: z.number().min(0).max(1).nullable().optional(),
  stroke: z.string().nullable(),
  strokeWidth: z.number().nullable(),
  strokeOpacity: z.number().min(0).max(1).nullable().optional(),
  strokePosition: z.enum(['center', 'inside', 'outside']).nullable().optional(),
  lineCap: z.enum(['butt', 'round', 'square']).nullable().optional(),
  lineJoin: z.enum(['miter', 'round', 'bevel']).nullable().optional(),
  cornerRadius: z.number().nullable(),
  cornerRadiusTL: z.number().nullable().optional(),
  cornerRadiusTR: z.number().nullable().optional(),
  cornerRadiusBR: z.number().nullable().optional(),
  cornerRadiusBL: z.number().nullable().optional(),
  shadowColor: z.string().nullable().optional(),
  shadowOpacity: z.number().min(0).max(1).nullable().optional(),
  shadowBlur: z.number().min(0).nullable().optional(),
  shadowOffsetX: z.number().nullable().optional(),
  shadowOffsetY: z.number().nullable().optional(),
  blurRadius: z.number().min(0).nullable().optional(),
  zIndex: z.number().int(),
  bind: z.object({
    boneId: z.string().min(1),
    offsetX: z.number(),
    offsetY: z.number(),
    offsetRotation: z.number()
  }).nullable(),
  pivotX: z.number().nullable().optional(),
  pivotY: z.number().nullable().optional()
});

const rectSchema = nodeBaseSchema.extend({
  type: z.literal('rect')
});

const ellipseSchema = nodeBaseSchema.extend({
  type: z.literal('ellipse')
});

const lineSchema = nodeBaseSchema.extend({
  type: z.literal('line'),
  points: z.array(z.number())
});

const pathSchema = nodeBaseSchema.extend({
  type: z.literal('path'),
  pathData: z.string().min(1),
  pathPoints: z
    .array(
      z.object({
        x: z.number(),
        y: z.number(),
        out: z
          .object({
            x: z.number(),
            y: z.number()
          })
          .optional()
      })
    )
    .optional()
});

const textSchema = nodeBaseSchema.extend({
  type: z.literal('text'),
  text: z.string(),
  fontSize: z.number(),
  fontFamily: z.string(),
  fontWeight: z.union([z.number(), z.string()]).nullable(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  lineHeight: z.number().nullable().optional(),
  letterSpacing: z.number().nullable().optional()
});

const imageSchema = nodeBaseSchema.extend({
  type: z.literal('image'),
  src: z.string().min(1)
});

const groupSchema = nodeBaseSchema.extend({
  type: z.literal('group')
});

const symbolInstanceSchema = nodeBaseSchema.extend({
  type: z.literal('symbol'),
  symbolId: z.string().min(1),
  overrides: z.array(z.object({
    nodeId: z.string().min(1),
    patch: nodeBaseSchema.partial()
  }))
});

const meshSchema = nodeBaseSchema.extend({
  type: z.literal('mesh'),
  vertices: z.array(z.number()),
  triangles: z.array(z.number()),
  weights: z.array(z.array(z.object({
    boneId: z.string().min(1),
    weight: z.number()
  })))
});

export const nodeSchema = z.discriminatedUnion('type', [
  rectSchema,
  ellipseSchema,
  lineSchema,
  pathSchema,
  textSchema,
  imageSchema,
  groupSchema,
  symbolInstanceSchema,
  meshSchema
]);

export const responsiveRuleSchema = z.object({
  id: z.string().min(1),
  minWidth: z.number().nonnegative(),
  maxWidth: z.number().nonnegative(),
  variantId: z.string().min(1)
});

export const frameSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  isHold: z.boolean(),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  background: z.string().nullable(),
  duration: z.number().nonnegative(),
  nodes: z.array(nodeSchema),
  variants: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    width: z.number().positive(),
    height: z.number().positive(),
    nodes: z.array(nodeSchema)
  })),
  responsiveRules: z.array(responsiveRuleSchema)
});

export const transitionSchema = z.object({
  id: z.string().min(1),
  fromFrameId: z.string().min(1),
  toFrameId: z.string().min(1),
  duration: z.number().nonnegative(),
  delay: z.number().nonnegative(),
  animation: z.enum(['auto', 'linear', 'instant', 'dissolve']).optional().default('auto'),
  easing: z.enum([
    'linear',
    'ease',
    'ease-in',
    'ease-out',
    'spring',
    'bounce',
    'overshoot'
  ]),
  overrides: z.array(z.object({
    nodeId: z.string().min(1),
    property: z.enum([
      'x',
      'y',
      'width',
      'height',
      'rotation',
      'scaleX',
      'scaleY',
      'opacity'
    ]),
    easing: z.enum([
      'linear',
      'ease',
      'ease-in',
      'ease-out',
      'spring',
      'bounce',
      'overshoot'
    ])
  })),
  stagger: z.object({
    mode: z.enum(['none', 'order', 'distance']),
    amount: z.number().nonnegative()
  })
});

export const sceneSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1),
  frames: z.array(frameSchema).min(1),
  transitions: z.array(transitionSchema),
  startFrameId: z.string().min(1),
  symbols: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    nodes: z.array(nodeSchema)
  })),
  stateMachine: z.object({
    initialStateId: z.string().nullable(),
    inputs: z.array(z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      type: z.enum(['boolean', 'number', 'string', 'trigger']),
      defaultValue: z.union([z.boolean(), z.number(), z.string(), z.null()])
    })),
    states: z.array(z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      frameId: z.string().min(1)
    })),
    transitions: z.array(z.object({
      id: z.string().min(1),
      fromStateId: z.string().min(1),
      toStateId: z.string().min(1),
      inputId: z.string().min(1),
      condition: z.string()
    }))
  }),
  collaboration: z.object({
    enabled: z.boolean(),
    roomId: z.string().nullable(),
    participants: z.array(z.string())
  }),
  enterprise: z.object({
    roles: z.array(z.string()),
    permissions: z.array(z.string()),
    auditLog: z.array(z.string())
  }),
  billing: z.object({
    plan: z.string(),
    status: z.enum(['active', 'trial', 'past_due']),
    seats: z.number().nonnegative()
  }),
  skeletons: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    bones: z.array(z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      parentId: z.string().nullable(),
      x: z.number(),
      y: z.number(),
      length: z.number().nonnegative(),
      rotation: z.number()
    })),
    constraints: z.array(z.union([
      z.object({
        type: z.literal('aim'),
        boneId: z.string().min(1),
        targetX: z.number(),
        targetY: z.number()
      }),
      z.object({
        type: z.literal('ik'),
        chain: z.array(z.string().min(1)),
        targetX: z.number(),
        targetY: z.number()
      })
    ]))
  })),
  controllers: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    targetNodeId: z.string().min(1),
    property: z.enum([
      'x',
      'y',
      'width',
      'height',
      'rotation',
      'scaleX',
      'scaleY',
      'opacity',
      'cornerRadius',
      'lineLength'
    ]),
    min: z.number(),
    max: z.number()
  })),
  metadata: z.record(z.string(), z.unknown())
});

export const motionTrackSchema = z.object({
  nodeId: z.string().min(1),
  property: z.enum([
    'x',
    'y',
    'width',
    'height',
    'rotation',
    'scaleX',
    'scaleY',
    'opacity',
    'cornerRadius',
    'lineLength'
  ]),
  from: z.number(),
  to: z.number(),
  duration: z.number().nonnegative(),
  delay: z.number().nonnegative(),
  easing: z.enum([
    'linear',
    'ease',
    'ease-in',
    'ease-out',
    'spring',
    'bounce',
    'overshoot'
  ])
});

export const motionTransitionSchema = z.object({
  id: z.string().min(1),
  fromFrameId: z.string().min(1),
  toFrameId: z.string().min(1),
  duration: z.number().nonnegative(),
  delay: z.number().nonnegative(),
  tracks: z.array(motionTrackSchema)
});

export const motionSchema = z.object({
  version: z.literal(1),
  transitions: z.array(motionTransitionSchema)
});

export const dmxAssetSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['svg', 'png', 'jpg']),
  mimeType: z.string().min(1),
  name: z.string().min(1),
  byteSize: z.number().nonnegative(),
  storage: z.enum(['embedded', 'external']),
  data: z.string().optional(),
  externalRef: z.string().optional(),
  hash: z.string().nullable().optional()
});

export const dmxFrameVariantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  isBase: z.boolean()
});

export const dmxFrameSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  orderIndex: z.number().int().nonnegative(),
  durationMs: z.number().nonnegative(),
  isHold: z.boolean(),
  width: z.number().positive(),
  height: z.number().positive(),
  background: z.string(),
  variants: z.array(dmxFrameVariantSchema),
  responsiveRules: z.array(responsiveRuleSchema).optional(),
  layersByVariant: z.record(z.string(), z.array(nodeSchema))
});

export const dmxTransitionSchema = z.object({
  id: z.string().min(1),
  fromFrameId: z.string().min(1),
  toFrameId: z.string().min(1),
  durationMs: z.number().nonnegative(),
  delayMs: z.number().nonnegative(),
  animationType: z.enum(['auto', 'linear', 'instant', 'dissolve']),
  easingPreset: z.enum(['easeIn', 'easeOut', 'easeInOut', 'linear'])
});

export const dmxEditorSchema = z.object({
  activeTool: z.string().min(1),
  selectedFrameId: z.string().nullable(),
  selectedLayerIds: z.array(z.string()),
  zoom: z.number().positive(),
  pan: z.object({ x: z.number(), y: z.number() }),
  playMode: z.boolean().optional(),
  playStartFrameId: z.string().nullable().optional(),
  panelMode: z.enum(['design', 'animate'])
});

export const dmxSchema = z.object({
  format: z.literal('dmx'),
  formatVersion: z.literal('1.0.0'),
  app: z.object({
    name: z.literal('Dream Motion'),
    build: z.string().min(1)
  }),
  meta: z.object({
    documentId: z.string().min(1),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
    checksum: z.string().nullable().optional()
  }),
  settings: z.object({
    canvas: z.object({
      width: z.number().positive(),
      height: z.number().positive(),
      background: z.string()
    }),
    fps: z.number().positive(),
    grid: z.object({ enabled: z.boolean(), size: z.number().positive() }),
    guides: z.object({ enabled: z.boolean() })
  }),
  assets: z.record(z.string(), dmxAssetSchema),
  frames: z.array(dmxFrameSchema).min(1),
  transitions: z.array(dmxTransitionSchema),
  playStartFrameId: z.string().min(1).optional(),
  editor: dmxEditorSchema.optional()
});

export type SceneSchema = z.infer<typeof sceneSchema>;
export type MotionSchema = z.infer<typeof motionSchema>;
