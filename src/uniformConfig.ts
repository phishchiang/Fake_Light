export const uniformConfig = {
    modelMatrix:{
        size: 16,
        offset: 0,
    },          
    viewMatrix:{
        size: 16,
        offset: 16,
    },
    projectionMatrix:{
        size: 16,
        offset: 32,
    },  
    cameraPosition: { 
        size: 4, // 3D position + 1 padding
        offset: 48, 
    },
    canvasSize: {
        size: 2,
        offset: 52,
    }, 
    uOverallRadius: {
        size: 1,
        offset: 54,
    },
    uConeRadius: {
        size: 1,
        offset: 55,
    },
    uLightLength: {
        size: 1,
        offset: 56,
    },
    uTime: {
        size: 1,
        offset: 57,
    },
  };