export const uniformConfig = {
    modelMatrix:{
        size: 16,          // Size of the model matrix (4x4 matrix)
        offset: 0,         // Offset for model matrix in the uniform buffer
    },          
    viewMatrix:{
        size: 16,          // Size of the view matrix (4x4 matrix)
        offset: 16,        // Offset for view matrix in the uniform buffer
    },
    projectionMatrix:{
        size: 16,          // Size of the projection matrix (4x4 matrix)
        offset: 32,        // Offset for projection matrix in the uniform buffer
    },  
    canvasSize: {
        size: 2,            // Size of the canvas size (vec2)
        offset: 48,         // Offset for canvas size in the uniform buffer
    }, 
    uOverallRadius: {
        size: 1,            // Size of the test value (float)
        offset: 50,         // Offset for uTestValue in the uniform buffer
    },
    uConeRadius: {
        size: 1,            // Size of the test value (float)
        offset: 51,         // Offset for uTestValue_02 in the uniform buffer
    },
    uLightLength: {
        size: 1,            // Size of the test value (float)
        offset: 52,         // Offset for uTestValue_02 in the uniform buffer
    },
    // Add more offsets as needed
  };