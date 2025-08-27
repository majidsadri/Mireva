// Central image exports for better iOS compatibility
let images = {};

try {
  images = {
    mirevaLogo: require('./mireva-logo.png'),
    googleLogo: require('./google-logo.jpg'),
    faceIdLogo: require('./face-id-logo.png'),
    headerLogo: require('./IMG_4544.png'),
    mirevaTop: require('./Mireva-top.png'),
  };
  console.log('Images loaded successfully');
} catch (error) {
  console.error('Error loading images:', error);
  images = {
    mirevaLogo: null,
    googleLogo: null,
    faceIdLogo: null,
    headerLogo: null,
    mirevaTop: null,
  };
}

export { images };
export default images;