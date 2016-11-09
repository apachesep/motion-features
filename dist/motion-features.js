'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _assign = require('babel-runtime/core-js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Create a function that returns time in seconds according to the current
 * environnement (node or browser).
 * If running in node the time rely on `process.hrtime`, while if in the browser
 * it is provided by the `Date` object.
 *
 * @return {Function}
 * @private
 */
function getTimeFunction() {
  if (typeof window === 'undefined') {
    // assume node
    return function () {
      var t = process.hrtime();
      return t[0] + t[1] * 1e-9;
    };
  } else {
    // browser
    if (window.performance === 'undefined') {
      if (Date.now === 'undefined') {
        return function () {
          return new Date.getTime();
        };
      } else {
        return function () {
          return Date.now();
        };
      }
    } else {
      return function () {
        return window.performance.now();
      };
    }
  }
}

var perfNow = getTimeFunction();

/**
 * @todo typedef constructor argument
 */

/**
 * Class computing the descriptors from accelerometer and gyroscope data.
 * <br />
 * Example :
 * ```JavaScript
 * // es6 with browserify :
 * import { MotionFeatures } from 'motion-features'; 
 * const mf = new MotionFeatures({ descriptors: ['accIntensity', 'kick'] });
 *
 * // es5 with browserify :
 * var motionFeatures = require('motion-features');
 * var mf = new motionFeatures.MotionFeatures({ descriptors: ['accIntensity', 'kick'] });
 *
 * // loading from a "script" tag :
 * var mf = new motionFeatures.MotionFeatures({ descriptors: ['accIntensity', 'kick'] });
 *
 * // then, on each motion event :
 * mf.setAccelerometer(x, y, z);
 * mf.setGyroscopes(alpha, beta, theta);
 * mf.update(function(err, res) {
 *   if (err === null) {
 *     // do something with res
 *   }
 * });
 * ```
 * @class
 */

var MotionFeatures = function () {

  /**
   * @param {Object} initObject - object containing an array of the
   * required descriptors and some variables used to compute the descriptors
   * that you might want to change (for example if the browser is chrome you
   * might want to set `gyrIsInDegrees` to false because it's the case on some
   * versions, or you might want to change some thresholds).
   * See the code for more details.
   *
   * @todo use typedef to describe the configuration parameters
   */
  function MotionFeatures() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    (0, _classCallCheck3.default)(this, MotionFeatures);

    var defaults = {
      descriptors: ['accRaw', 'gyrRaw', 'accIntensity', 'gyrIntensity', 'freefall', 'kick', 'shake', 'spin', 'still'],

      gyrIsInDegrees: true,

      accIntensityParam1: 0.8,
      accIntensityParam2: 0.1,

      gyrIntensityParam1: 0.9,
      gyrIntensityParam2: 1,

      freefallAccThresh: 0.15,
      freefallGyrThresh: 750,
      freefallGyrDeltaThresh: 40,

      kickThresh: 0.01,
      kickSpeedGate: 200,
      kickMedianFiltersize: 9,

      shakeThresh: 0.1,
      shakeWindowSize: 200,
      shakeSlideFactor: 10,

      spinThresh: 200,

      stillThresh: 5000,
      stillSlideFactor: 5
    };

    this._params = (0, _assign2.default)({}, defaults, options);
    //console.log(this._params.descriptors);

    this._methods = {
      accRaw: this._updateAccRaw.bind(this),
      gyrRaw: this._updateGyrRaw.bind(this),
      accIntensity: this._updateAccIntensity.bind(this),
      gyrIntensity: this._updateGyrIntensity.bind(this),
      freefall: this._updateFreefall.bind(this),
      kick: this._updateKick.bind(this),
      shake: this._updateShake.bind(this),
      spin: this._updateSpin.bind(this),
      still: this._updateStill.bind(this)
    };

    this.acc = [0, 0, 0];
    this.gyr = [0, 0, 0];

    //============================================================ acc intensity
    this._accLast = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    this._accIntensityLast = [[0, 0], [0, 0], [0, 0]];
    this._accIntensity = [0, 0, 0];
    this._accIntensityNorm = 0;

    //================================================================= freefall
    this._accNorm = 0;
    this._gyrDelta = [0, 0, 0];
    this._gyrNorm = 0;
    this._gyrDeltaNorm = 0;
    this._fallBegin = perfNow();
    this._fallEnd = perfNow();
    this._fallDuration = 0;
    this._isFalling = false;

    //============================================================ gyr intensity
    this._gyrLast = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    this._gyrIntensityLast = [[0, 0], [0, 0], [0, 0]];
    this._gyrIntensity = [0, 0, 0];
    this._gyrIntensityNorm = 0;

    //===================================================================== kick
    this._kickIntensity = 0;
    this._lastKick = 0;
    this._isKicking = false;
    this._medianValues = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    this._medianLinking = [3, 4, 1, 5, 7, 8, 0, 2, 6];
    this._medianFifo = [6, 2, 7, 0, 1, 3, 8, 4, 5];
    this._i1 = 0;
    this._i2 = 0;
    this._i3 = 0;
    this._accIntensityNormMedian = 0;

    //==================================================================== shake
    this._accDelta = [0, 0, 0];
    this._shakeWindow = [new Array(this._params.shakeWindowSize), new Array(this._params.shakeWindowSize), new Array(this._params.shakeWindowSize)];
    for (var i = 0; i < 3; i++) {
      for (var j = 0; j < this._params.shakeWindowSize; j++) {
        this._shakeWindow[i][j] = 0;
      }
    }
    this._shakeNb = [0, 0, 0];
    this._shakingRaw = 0;
    this._shakeSlidePrev = 0;
    this._shaking = 0;

    //===================================================================== spin
    this._spinBegin = perfNow();
    this._spinEnd = perfNow();
    this._spinDuration = 0;
    this._isSpinning = false;

    //==================================================================== still
    this._stillCrossProd = 0;
    this._stillSlide = 0;
    this._stillSlidePrev = 0;
    this._isStill = false;

    this._loopIndexPeriod = this._lcm(this._lcm(this._lcm(2, 3), this._params.kickMedianFiltersize), this._params.shakeWindowSize);
    //console.log(this._loopIndexPeriod);
    this._loopIndex = 0;
  }

  //========== interface =========//

  /**
   * sSets the current accelerometer values.
   * @param {Number} x - the accelerometer's x value
   * @param {Number} y - the accelerometer's y value
   * @param {Number} z - the accelerometer's z value
   */


  (0, _createClass3.default)(MotionFeatures, [{
    key: 'setAccelerometer',
    value: function setAccelerometer(x, y, z) {
      this.acc[0] = x;
      this.acc[1] = y;
      this.acc[2] = z;
    }

    /**
     * Sets the current gyroscope values.
     * @param {Number} x - the gyroscope's x value
     * @param {Number} y - the gyroscope's y value
     * @param {Number} z - the gyroscope's z value
     */

  }, {
    key: 'setGyroscope',
    value: function setGyroscope(x, y, z) {
      this.gyr[0] = x;
      this.gyr[1] = y;
      this.gyr[2] = z;
      if (this._params.gyrIsInDegrees) {
        for (var i = 0; i < 3; i++) {
          this.gyr[i] *= 2 * Math.PI / 360.;
        }
      }
    }

    /**
     * Intensity of the movement sensed by an accelerometer.
     * @typedef accIntensity
     * @type {Object}
     * @property {Number} norm - the global energy computed on all dimensions.
     * @property {Number} x - the energy in the x (first) dimension.
     * @property {Number} y - the energy in the y (second) dimension.
     * @property {Number} z - the energy in the z (third) dimension.
     */

    /**
     * Intensity of the movement sensed by a gyroscope.
     * @typedef gyrIntensity
     * @type {Object}
     * @property {Number} norm - the global energy computed on all dimensions.
     * @property {Number} x - the energy in the x (first) dimension.
     * @property {Number} y - the energy in the y (second) dimension.
     * @property {Number} z - the energy in the z (third) dimension.
     */

    /**
     * Information about the free falling state of the sensor.
     * @typedef freefall
     * @type {Object}
     * @property {Number} accNorm - the norm of the acceleration.
     * @property {Boolean} falling - true if the sensor is free falling, false otherwise.
     * @property {Number} duration - the duration of the free falling since its beginning.
     */

    /**
     * Impulse / hit movement detection information.
     * @typedef kick
     * @type {Object}
     * @property {Number} intensity - the current intensity of the "kick" gesture.
     * @property {Boolean} kicking - true if a "kick" gesture is being detected, false otherwise.
     */

    /**
     * Shake movement detection information.
     * @typedef shake
     * @type {Object}
     * @property {Number} shaking - the current amount of "shakiness".
     */

    /**
     * Information about the spinning state of the sensor.
     * @typedef spin
     * @type {Object}
     * @property {Boolean} spinning - true if the sensor is spinning, false otherwise.
     * @property {Number} duration - the duration of the spinning since its beginning.
     * @property {Number} gyrNorm - the norm of the rotation speed.
     */

    /**
     * Information about the stillness of the sensor.
     * @typedef still
     * @type {Object}
     * @property {Boolean} still - true if the sensor is still, false otherwise.
     * @property {Number} slide - the original value thresholded to determine stillness.
     */

    /**
     * Computed features.
     * @typedef features
     * @type {Object}
     * @property {accIntensity} accIntensity - Intensity of the movement sensed by an accelerometer.
     * @property {gyrIntensity} gyrIntensity - Intensity of the movement sensed by a gyroscope.
     * @property {freefall} freefall - Information about the free falling state of the sensor.
     * @property {kick} kick - Impulse / hit movement detection information.
     * @property {shake} shake - Shake movement detection information.
     * @property {spin} spin - Information about the spinning state of the sensor.
     * @property {still} still - Information about the stillness of the sensor.
     */

    /**
     * Callback handling the features.
     * @callback featuresCallback
     * @param {String} err - Description of a potential error.
     * @param {features} res - Object holding the feature values.
     */

    /**
     * Triggers computation of the descriptors from the current sensor values and
     * pass the results to a callback
     * @param {featuresCallback} [callback=null] - The callback handling the last computed descriptors
     * @returns {features} features - Return these computed descriptors anyway
     */

  }, {
    key: 'update',
    value: function update() {
      var callback = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;

      // DEAL WITH this._elapsedTime
      this._elapsedTime = perfNow();
      // is this one used by several features ?
      this._accNorm = this._magnitude3D(this.acc);
      // this one needs be here because used by freefall AND spin
      this._gyrNorm = this._magnitude3D(this.gyr);

      var err = null;
      var res = null;
      try {
        res = {};
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = (0, _getIterator3.default)(this._params.descriptors), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var key = _step.value;

            if (this._methods[key]) {
              this._methods[key](res);
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
      } catch (e) {
        err = e;
      }

      this._loopIndex = (this._loopIndex + 1) % this._loopIndexPeriod;

      if (callback) {
        callback(err, res);
      }
      return res;
    }

    //==========================================================================//
    //====================== specific descriptors computing ====================//
    //==========================================================================//

    /** @private */

  }, {
    key: '_updateAccRaw',
    value: function _updateAccRaw(res) {
      res.accRaw = {
        x: this.acc[0],
        y: this.acc[1],
        z: this.acc[2]
      };
    }

    /** @private */

  }, {
    key: '_updateGyrRaw',
    value: function _updateGyrRaw(res) {
      res.gyrRaw = {
        x: this.gyr[0],
        y: this.gyr[1],
        z: this.gyr[2]
      };
    }

    //============================================================== acc intensity
    /** @private */

  }, {
    key: '_updateAccIntensity',
    value: function _updateAccIntensity(res) {
      this._accIntensityNorm = 0;

      for (var i = 0; i < 3; i++) {
        this._accLast[i][this._loopIndex % 3] = this.acc[i];

        this._accIntensity[i] = this._intensity1D(this.acc[i], this._accLast[i][(this._loopIndex + 1) % 3], this._accIntensityLast[i][(this._loopIndex + 1) % 2], this._params.accIntensityParam1, this._params.accIntensityParam2, 1);

        this._accIntensityLast[i][this._loopIndex % 2] = this._accIntensity[i];

        this._accIntensityNorm += this._accIntensity[i];
      }

      res.accIntensity = {
        norm: this._accIntensityNorm,
        x: this._accIntensity[0],
        y: this._accIntensity[1],
        z: this._accIntensity[2]
      };
    }

    //============================================================== gyr intensity
    /** @private */

  }, {
    key: '_updateGyrIntensity',
    value: function _updateGyrIntensity(res) {
      this._gyrIntensityNorm = 0;

      for (var i = 0; i < 3; i++) {
        this._gyrLast[i][this._loopIndex % 3] = this.gyr[i];

        this._gyrIntensity[i] = this._intensity1D(this.gyr[i], this._gyrLast[i][(this._loopIndex + 1) % 3], this._gyrIntensityLast[i][(this._loopIndex + 1) % 2], this._params.gyrIntensityParam1, this._params.gyrIntensityParam2, 1);

        this._gyrIntensityLast[i][this._loopIndex % 2] = this._gyrIntensity[i];

        this._gyrIntensityNorm += this._gyrIntensity[i];
      }

      res.gyrIntensity = {
        norm: this._gyrIntensityNorm,
        x: this._gyrIntensity[0],
        y: this._gyrIntensity[1],
        z: this._gyrIntensity[2]
      };
    }

    //=================================================================== freefall
    /** @private */

  }, {
    key: '_updateFreefall',
    value: function _updateFreefall(res) {
      for (var i = 0; i < 3; i++) {
        this._gyrDelta[i] = this._delta(this._gyrLast[i][(this._loopIndex + 1) % 3], this.gyr[i], 1);
      }

      this._gyrDeltaNorm = this._magnitude3D(this._gyrDelta);

      if (this._accNorm < this._params.freefallAccThresh || this._gyrNorm > this._params.freefallGyrThresh && this._gyrDeltaNorm < this._params.freefallGyrDeltaThresh) {
        if (!this._isFalling) {
          this._isFalling = true;
          this._fallBegin = perfNow();
        }
        this._fallEnd = perfNow();
      } else {
        if (this._isFalling) {
          this._isFalling = false;
        }
      }
      this._fallDuration = this._fallEnd - this._fallBegin;

      res.freefall = {
        accNorm: this._accNorm,
        falling: this._isFalling,
        duration: this._fallDuration
      };
    }

    //======================================================================= kick
    /** @private */

  }, {
    key: '_updateKick',
    value: function _updateKick(res) {
      this._i3 = this._loopIndex % this._params.kickMedianFiltersize;
      this._i1 = this._medianFifo[this._i3];
      this._i2 = 1;

      if (this._i1 < this._params.kickMedianFiltersize && this._accIntensityNorm > this._medianValues[this._i1 + this._i2]) {
        // check right
        while (this._i1 + this._i2 < this.kickMedianFiltersize && this._accIntensityNorm > this._medianValues[this._i1 + this._i2]) {
          this._medianFifo[this._medianLinking[this._i1 + this._i2]] = this._medianFifo[this._medianLinking[this._i1 + this._i2]] - 1;
          this._medianValues[this._i1 + this._i2 - 1] = this._medianValues[this._i1 + this._i2];
          this._medianLinking[this._i1 + this._i2 - 1] = this._medianLinking[this._i1 + this._i2];
          this._i2++;
        }
        this._medianValues[this._i1 + this._i2 - 1] = this._accIntensityNorm;
        this._medianLinking[this._i1 + this._i2 - 1] = this._i3;
        this._medianFifo[this._i3] = this._i1 + this._i2 - 1;
      } else {
        // check left
        while (this._i2 < this._i1 + 1 && this._accIntensityNorm < this._medianValues[this._i1 - this._i2]) {
          this._medianFifo[this._medianLinking[this._i1 - this._i2]] = this._medianFifo[this._medianLinking[this._i1 - this._i2]] + 1;
          this._medianValues[this._i1 - this._i2 + 1] = this._medianValues[this._i1 - this._i2];
          this._medianLinking[this._i1 - this._i2 + 1] = this._medianLinking[this._i1 - this._i2];
          this._i2++;
        }
        this._medianValues[this._i1 - this._i2 + 1] = this._accIntensityNorm;
        this._medianLinking[this._i1 - this._i2 + 1] = this._i3;
        this._medianFifo[this._i3] = this._i1 - this._i2 + 1;
      }

      // compare current intensity norm with previous median value
      if (this._accIntensityNorm - this._accIntensityNormMedian > this._params.kickThresh) {
        if (this._isKicking) {
          if (this._kickIntensity < this._accIntensityNorm) {
            this._kickIntensity = this._accIntensityNorm;
          }
        } else {
          this._isKicking = true;
          this._kickIntensity = this._accIntensityNorm;
          this._lastKick = this._elapsedTime;
        }
      } else {
        if (this._elapsedTime - this._lastKick > this._params.kickSpeedGate) {
          this._isKicking = false;
        }
      }

      this._accIntensityNormMedian = this._medianValues[this._params.kickMedianFiltersize];

      res.kick = {
        intensity: this._kickIntensity,
        kicking: this._isKicking
      };
    }

    //====================================================================== shake
    /** @private */

  }, {
    key: '_updateShake',
    value: function _updateShake(res) {
      for (var i = 0; i < 3; i++) {
        this._accDelta[i] = this._delta(this._accLast[i][(this._loopIndex + 1) % 3], this.acc[i], 1);
      }

      for (var _i = 0; _i < 3; _i++) {
        if (this._shakeWindow[_i][this._loopIndex % this._params.shakeWindowSize]) {
          this._shakeNb[_i]--;
        }
        if (this._accDelta[_i] > this._params.shakeThresh) {
          this._shakeWindow[_i][this._loopIndex % this._params.shakeWindowSize] = 1;
          this._shakeNb[_i]++;
        } else {
          this._shakeWindow[_i][this._loopIndex % this._params.shakeWindowSize] = 0;
        }
      }

      this._shakingRaw = this._magnitude3D(this._shakeNb) / this._params.shakeWindowSize;
      this._shakeSlidePrev = this._shaking;
      this._shaking = this._slide(this._shakeSlidePrev, this._shakingRaw, this._params.shakeSlideFactor);

      res.shake = {
        shaking: this._shaking
      };
    }

    //======================================================================= spin
    /** @private */

  }, {
    key: '_updateSpin',
    value: function _updateSpin(res) {
      if (this._gyrNorm > this._params.spinThresh) {
        if (!this._isSpinning) {
          this._isSpinning = true;
          this._spinBegin = perfNow();
        }
        this._spinEnd = perfNow();
      } else if (this._isSpinning) {
        this._isSpinning = false;
      }
      this._spinDuration = this._spinEnd - this._spinBegin;

      res.spin = {
        spinning: this._isSpinning,
        duration: this._spinDuration,
        gyrNorm: this._gyrNorm
      };
    }

    //====================================================================== still
    /** @private */

  }, {
    key: '_updateStill',
    value: function _updateStill(res) {
      this._stillCrossProd = this._stillCrossProduct(this.gyr);
      this._stillSlidePrev = this._stillSlide;
      this._stillSlide = this._slide(this._stillSlidePrev, this._stillCrossProd, this._params.stillSlideFactor);

      if (this._stillSlide > this._params.stillThresh) {
        this._isStill = false;
      } else {
        this._isStill = true;
      }

      res.still = {
        still: this._isStill,
        slide: this._stillSlide
      };
    }

    //==========================================================================//
    //================================ UTILITIES ===============================//
    //==========================================================================//
    /** @private */

  }, {
    key: '_delta',
    value: function _delta(prev, next, dt) {
      return (next - prev) / (2 * dt);
    }

    /** @private */

  }, {
    key: '_intensity1D',
    value: function _intensity1D(nextX, prevX, prevIntensity, param1, param2, dt) {
      var dx = this._delta(nextX, prevX, dt); //(nextX - prevX) / (2 * dt);
      return param2 * dx * dx + param1 * prevIntensity;
    }

    /** @private */

  }, {
    key: '_magnitude3D',
    value: function _magnitude3D(xyzArray) {
      return Math.sqrt(xyzArray[0] * xyzArray[0] + xyzArray[1] * xyzArray[1] + xyzArray[2] * xyzArray[2]);
    }

    /** @private */

  }, {
    key: '_lcm',
    value: function _lcm(a, b) {
      var a1 = a,
          b1 = b;

      while (a1 != b1) {
        if (a1 < b1) {
          a1 += a;
        } else {
          b1 += b;
        }
      }

      return a1;
    }

    /** @private */

  }, {
    key: '_slide',
    value: function _slide(prevSlide, currentVal, slideFactor) {
      return prevSlide + (currentVal - prevSlide) / slideFactor;
    }

    /** @private */

  }, {
    key: '_stillCrossProduct',
    value: function _stillCrossProduct(xyzArray) {
      return (xyzArray[1] - xyzArray[2]) * (xyzArray[1] - xyzArray[2]) + (xyzArray[0] - xyzArray[1]) * (xyzArray[0] - xyzArray[1]) + (xyzArray[2] - xyzArray[0]) * (xyzArray[2] - xyzArray[0]);
    }
  }]);
  return MotionFeatures;
}();

exports.default = MotionFeatures;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1vdGlvbi1mZWF0dXJlcy5qcyJdLCJuYW1lcyI6WyJnZXRUaW1lRnVuY3Rpb24iLCJ3aW5kb3ciLCJ0IiwicHJvY2VzcyIsImhydGltZSIsInBlcmZvcm1hbmNlIiwiRGF0ZSIsIm5vdyIsImdldFRpbWUiLCJwZXJmTm93IiwiTW90aW9uRmVhdHVyZXMiLCJvcHRpb25zIiwiZGVmYXVsdHMiLCJkZXNjcmlwdG9ycyIsImd5cklzSW5EZWdyZWVzIiwiYWNjSW50ZW5zaXR5UGFyYW0xIiwiYWNjSW50ZW5zaXR5UGFyYW0yIiwiZ3lySW50ZW5zaXR5UGFyYW0xIiwiZ3lySW50ZW5zaXR5UGFyYW0yIiwiZnJlZWZhbGxBY2NUaHJlc2giLCJmcmVlZmFsbEd5clRocmVzaCIsImZyZWVmYWxsR3lyRGVsdGFUaHJlc2giLCJraWNrVGhyZXNoIiwia2lja1NwZWVkR2F0ZSIsImtpY2tNZWRpYW5GaWx0ZXJzaXplIiwic2hha2VUaHJlc2giLCJzaGFrZVdpbmRvd1NpemUiLCJzaGFrZVNsaWRlRmFjdG9yIiwic3BpblRocmVzaCIsInN0aWxsVGhyZXNoIiwic3RpbGxTbGlkZUZhY3RvciIsIl9wYXJhbXMiLCJfbWV0aG9kcyIsImFjY1JhdyIsIl91cGRhdGVBY2NSYXciLCJiaW5kIiwiZ3lyUmF3IiwiX3VwZGF0ZUd5clJhdyIsImFjY0ludGVuc2l0eSIsIl91cGRhdGVBY2NJbnRlbnNpdHkiLCJneXJJbnRlbnNpdHkiLCJfdXBkYXRlR3lySW50ZW5zaXR5IiwiZnJlZWZhbGwiLCJfdXBkYXRlRnJlZWZhbGwiLCJraWNrIiwiX3VwZGF0ZUtpY2siLCJzaGFrZSIsIl91cGRhdGVTaGFrZSIsInNwaW4iLCJfdXBkYXRlU3BpbiIsInN0aWxsIiwiX3VwZGF0ZVN0aWxsIiwiYWNjIiwiZ3lyIiwiX2FjY0xhc3QiLCJfYWNjSW50ZW5zaXR5TGFzdCIsIl9hY2NJbnRlbnNpdHkiLCJfYWNjSW50ZW5zaXR5Tm9ybSIsIl9hY2NOb3JtIiwiX2d5ckRlbHRhIiwiX2d5ck5vcm0iLCJfZ3lyRGVsdGFOb3JtIiwiX2ZhbGxCZWdpbiIsIl9mYWxsRW5kIiwiX2ZhbGxEdXJhdGlvbiIsIl9pc0ZhbGxpbmciLCJfZ3lyTGFzdCIsIl9neXJJbnRlbnNpdHlMYXN0IiwiX2d5ckludGVuc2l0eSIsIl9neXJJbnRlbnNpdHlOb3JtIiwiX2tpY2tJbnRlbnNpdHkiLCJfbGFzdEtpY2siLCJfaXNLaWNraW5nIiwiX21lZGlhblZhbHVlcyIsIl9tZWRpYW5MaW5raW5nIiwiX21lZGlhbkZpZm8iLCJfaTEiLCJfaTIiLCJfaTMiLCJfYWNjSW50ZW5zaXR5Tm9ybU1lZGlhbiIsIl9hY2NEZWx0YSIsIl9zaGFrZVdpbmRvdyIsIkFycmF5IiwiaSIsImoiLCJfc2hha2VOYiIsIl9zaGFraW5nUmF3IiwiX3NoYWtlU2xpZGVQcmV2IiwiX3NoYWtpbmciLCJfc3BpbkJlZ2luIiwiX3NwaW5FbmQiLCJfc3BpbkR1cmF0aW9uIiwiX2lzU3Bpbm5pbmciLCJfc3RpbGxDcm9zc1Byb2QiLCJfc3RpbGxTbGlkZSIsIl9zdGlsbFNsaWRlUHJldiIsIl9pc1N0aWxsIiwiX2xvb3BJbmRleFBlcmlvZCIsIl9sY20iLCJfbG9vcEluZGV4IiwieCIsInkiLCJ6IiwiTWF0aCIsIlBJIiwiY2FsbGJhY2siLCJfZWxhcHNlZFRpbWUiLCJfbWFnbml0dWRlM0QiLCJlcnIiLCJyZXMiLCJrZXkiLCJlIiwiX2ludGVuc2l0eTFEIiwibm9ybSIsIl9kZWx0YSIsImFjY05vcm0iLCJmYWxsaW5nIiwiZHVyYXRpb24iLCJpbnRlbnNpdHkiLCJraWNraW5nIiwiX3NsaWRlIiwic2hha2luZyIsInNwaW5uaW5nIiwiZ3lyTm9ybSIsIl9zdGlsbENyb3NzUHJvZHVjdCIsInNsaWRlIiwicHJldiIsIm5leHQiLCJkdCIsIm5leHRYIiwicHJldlgiLCJwcmV2SW50ZW5zaXR5IiwicGFyYW0xIiwicGFyYW0yIiwiZHgiLCJ4eXpBcnJheSIsInNxcnQiLCJhIiwiYiIsImExIiwiYjEiLCJwcmV2U2xpZGUiLCJjdXJyZW50VmFsIiwic2xp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Q0FBVCxJQUFjQSxTQUFTLENBQVQsQ0FBZixLQUErQkEsU0FBUyxDQUFULElBQWNBLFNBQVMsQ0FBVCxDQUE3QyxDQUZQO0FBR0Q7Ozs7O2tCQUdZN0gsYyIsImZpbGUiOiJtb3Rpb24tZmVhdHVyZXMuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENyZWF0ZSBhIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyB0aW1lIGluIHNlY29uZHMgYWNjb3JkaW5nIHRvIHRoZSBjdXJyZW50XG4gKiBlbnZpcm9ubmVtZW50IChub2RlIG9yIGJyb3dzZXIpLlxuICogSWYgcnVubmluZyBpbiBub2RlIHRoZSB0aW1lIHJlbHkgb24gYHByb2Nlc3MuaHJ0aW1lYCwgd2hpbGUgaWYgaW4gdGhlIGJyb3dzZXJcbiAqIGl0IGlzIHByb3ZpZGVkIGJ5IHRoZSBgRGF0ZWAgb2JqZWN0LlxuICpcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gZ2V0VGltZUZ1bmN0aW9uKCkge1xuICBpZiAodHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcpIHsgLy8gYXNzdW1lIG5vZGVcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgY29uc3QgdCA9IHByb2Nlc3MuaHJ0aW1lKCk7XG4gICAgICByZXR1cm4gdFswXSArIHRbMV0gKiAxZS05O1xuICAgIH1cbiAgfSBlbHNlIHsgLy8gYnJvd3NlclxuICAgIGlmICh3aW5kb3cucGVyZm9ybWFuY2UgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBpZiAoRGF0ZS5ub3cgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHJldHVybiAoKSA9PiB7IHJldHVybiBuZXcgRGF0ZS5nZXRUaW1lKCkgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAoKSA9PiB7IHJldHVybiBEYXRlLm5vdygpIH07XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAoKSA9PiB7IHJldHVybiB3aW5kb3cucGVyZm9ybWFuY2Uubm93KCkgfTtcbiAgICB9XG4gIH1cbn1cblxuY29uc3QgcGVyZk5vdyA9IGdldFRpbWVGdW5jdGlvbigpO1xuXG4vKipcbiAqIEB0b2RvIHR5cGVkZWYgY29uc3RydWN0b3IgYXJndW1lbnRcbiAqL1xuXG4vKipcbiAqIENsYXNzIGNvbXB1dGluZyB0aGUgZGVzY3JpcHRvcnMgZnJvbSBhY2NlbGVyb21ldGVyIGFuZCBneXJvc2NvcGUgZGF0YS5cbiAqIDxiciAvPlxuICogRXhhbXBsZSA6XG4gKiBgYGBKYXZhU2NyaXB0XG4gKiAvLyBlczYgd2l0aCBicm93c2VyaWZ5IDpcbiAqIGltcG9ydCB7IE1vdGlvbkZlYXR1cmVzIH0gZnJvbSAnbW90aW9uLWZlYXR1cmVzJzsgXG4gKiBjb25zdCBtZiA9IG5ldyBNb3Rpb25GZWF0dXJlcyh7IGRlc2NyaXB0b3JzOiBbJ2FjY0ludGVuc2l0eScsICdraWNrJ10gfSk7XG4gKlxuICogLy8gZXM1IHdpdGggYnJvd3NlcmlmeSA6XG4gKiB2YXIgbW90aW9uRmVhdHVyZXMgPSByZXF1aXJlKCdtb3Rpb24tZmVhdHVyZXMnKTtcbiAqIHZhciBtZiA9IG5ldyBtb3Rpb25GZWF0dXJlcy5Nb3Rpb25GZWF0dXJlcyh7IGRlc2NyaXB0b3JzOiBbJ2FjY0ludGVuc2l0eScsICdraWNrJ10gfSk7XG4gKlxuICogLy8gbG9hZGluZyBmcm9tIGEgXCJzY3JpcHRcIiB0YWcgOlxuICogdmFyIG1mID0gbmV3IG1vdGlvbkZlYXR1cmVzLk1vdGlvbkZlYXR1cmVzKHsgZGVzY3JpcHRvcnM6IFsnYWNjSW50ZW5zaXR5JywgJ2tpY2snXSB9KTtcbiAqXG4gKiAvLyB0aGVuLCBvbiBlYWNoIG1vdGlvbiBldmVudCA6XG4gKiBtZi5zZXRBY2NlbGVyb21ldGVyKHgsIHksIHopO1xuICogbWYuc2V0R3lyb3Njb3BlcyhhbHBoYSwgYmV0YSwgdGhldGEpO1xuICogbWYudXBkYXRlKGZ1bmN0aW9uKGVyciwgcmVzKSB7XG4gKiAgIGlmIChlcnIgPT09IG51bGwpIHtcbiAqICAgICAvLyBkbyBzb21ldGhpbmcgd2l0aCByZXNcbiAqICAgfVxuICogfSk7XG4gKiBgYGBcbiAqIEBjbGFzc1xuICovXG5jbGFzcyBNb3Rpb25GZWF0dXJlcyB7XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpbml0T2JqZWN0IC0gb2JqZWN0IGNvbnRhaW5pbmcgYW4gYXJyYXkgb2YgdGhlXG4gICAqIHJlcXVpcmVkIGRlc2NyaXB0b3JzIGFuZCBzb21lIHZhcmlhYmxlcyB1c2VkIHRvIGNvbXB1dGUgdGhlIGRlc2NyaXB0b3JzXG4gICAqIHRoYXQgeW91IG1pZ2h0IHdhbnQgdG8gY2hhbmdlIChmb3IgZXhhbXBsZSBpZiB0aGUgYnJvd3NlciBpcyBjaHJvbWUgeW91XG4gICAqIG1pZ2h0IHdhbnQgdG8gc2V0IGBneXJJc0luRGVncmVlc2AgdG8gZmFsc2UgYmVjYXVzZSBpdCdzIHRoZSBjYXNlIG9uIHNvbWVcbiAgICogdmVyc2lvbnMsIG9yIHlvdSBtaWdodCB3YW50IHRvIGNoYW5nZSBzb21lIHRocmVzaG9sZHMpLlxuICAgKiBTZWUgdGhlIGNvZGUgZm9yIG1vcmUgZGV0YWlscy5cbiAgICpcbiAgICogQHRvZG8gdXNlIHR5cGVkZWYgdG8gZGVzY3JpYmUgdGhlIGNvbmZpZ3VyYXRpb24gcGFyYW1ldGVyc1xuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3QgZGVmYXVsdHMgPSB7XG4gICAgICBkZXNjcmlwdG9yczogW1xuICAgICAgICAnYWNjUmF3JyxcbiAgICAgICAgJ2d5clJhdycsXG4gICAgICAgICdhY2NJbnRlbnNpdHknLFxuICAgICAgICAnZ3lySW50ZW5zaXR5JyxcbiAgICAgICAgJ2ZyZWVmYWxsJyxcbiAgICAgICAgJ2tpY2snLFxuICAgICAgICAnc2hha2UnLFxuICAgICAgICAnc3BpbicsXG4gICAgICAgICdzdGlsbCdcbiAgICAgIF0sXG5cbiAgICAgIGd5cklzSW5EZWdyZWVzOiB0cnVlLFxuXG4gICAgICBhY2NJbnRlbnNpdHlQYXJhbTE6IDAuOCxcbiAgICAgIGFjY0ludGVuc2l0eVBhcmFtMjogMC4xLFxuXG4gICAgICBneXJJbnRlbnNpdHlQYXJhbTE6IDAuOSxcbiAgICAgIGd5ckludGVuc2l0eVBhcmFtMjogMSxcblxuICAgICAgZnJlZWZhbGxBY2NUaHJlc2g6IDAuMTUsXG4gICAgICBmcmVlZmFsbEd5clRocmVzaDogNzUwLFxuICAgICAgZnJlZWZhbGxHeXJEZWx0YVRocmVzaDogNDAsXG5cbiAgICAgIGtpY2tUaHJlc2g6IDAuMDEsXG4gICAgICBraWNrU3BlZWRHYXRlOiAyMDAsXG4gICAgICBraWNrTWVkaWFuRmlsdGVyc2l6ZTogOSxcblxuICAgICAgc2hha2VUaHJlc2g6IDAuMSxcbiAgICAgIHNoYWtlV2luZG93U2l6ZTogMjAwLFxuICAgICAgc2hha2VTbGlkZUZhY3RvcjogMTAsXG5cbiAgICAgIHNwaW5UaHJlc2g6IDIwMCxcblxuICAgICAgc3RpbGxUaHJlc2g6IDUwMDAsXG4gICAgICBzdGlsbFNsaWRlRmFjdG9yOiA1LFxuICAgIH07XG5cbiAgICB0aGlzLl9wYXJhbXMgPSBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0cywgb3B0aW9ucyk7XG4gICAgLy9jb25zb2xlLmxvZyh0aGlzLl9wYXJhbXMuZGVzY3JpcHRvcnMpO1xuXG4gICAgdGhpcy5fbWV0aG9kcyA9IHtcbiAgICAgIGFjY1JhdzogdGhpcy5fdXBkYXRlQWNjUmF3LmJpbmQodGhpcyksXG4gICAgICBneXJSYXc6IHRoaXMuX3VwZGF0ZUd5clJhdy5iaW5kKHRoaXMpLFxuICAgICAgYWNjSW50ZW5zaXR5OiB0aGlzLl91cGRhdGVBY2NJbnRlbnNpdHkuYmluZCh0aGlzKSxcbiAgICAgIGd5ckludGVuc2l0eTogdGhpcy5fdXBkYXRlR3lySW50ZW5zaXR5LmJpbmQodGhpcyksXG4gICAgICBmcmVlZmFsbDogdGhpcy5fdXBkYXRlRnJlZWZhbGwuYmluZCh0aGlzKSxcbiAgICAgIGtpY2s6IHRoaXMuX3VwZGF0ZUtpY2suYmluZCh0aGlzKSxcbiAgICAgIHNoYWtlOiB0aGlzLl91cGRhdGVTaGFrZS5iaW5kKHRoaXMpLFxuICAgICAgc3BpbjogdGhpcy5fdXBkYXRlU3Bpbi5iaW5kKHRoaXMpLFxuICAgICAgc3RpbGw6IHRoaXMuX3VwZGF0ZVN0aWxsLmJpbmQodGhpcylcbiAgICB9O1xuXG4gICAgdGhpcy5hY2MgPSBbMCwgMCwgMF07XG4gICAgdGhpcy5neXIgPSBbMCwgMCwgMF07XG5cbiAgICAvLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSBhY2MgaW50ZW5zaXR5XG4gICAgdGhpcy5fYWNjTGFzdCA9IFtcbiAgICAgIFswLCAwLCAwXSxcbiAgICAgIFswLCAwLCAwXSxcbiAgICAgIFswLCAwLCAwXVxuICAgIF07XG4gICAgdGhpcy5fYWNjSW50ZW5zaXR5TGFzdCA9IFtcbiAgICAgIFswLCAwXSxcbiAgICAgIFswLCAwXSxcbiAgICAgIFswLCAwXVxuICAgIF07XG4gICAgdGhpcy5fYWNjSW50ZW5zaXR5ID0gWzAsIDAsIDBdO1xuICAgIHRoaXMuX2FjY0ludGVuc2l0eU5vcm0gPSAwO1xuXG4gICAgLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSBmcmVlZmFsbFxuICAgIHRoaXMuX2FjY05vcm0gPSAwO1xuICAgIHRoaXMuX2d5ckRlbHRhID0gWzAsIDAsIDBdO1xuICAgIHRoaXMuX2d5ck5vcm0gPSAwO1xuICAgIHRoaXMuX2d5ckRlbHRhTm9ybSA9IDA7XG4gICAgdGhpcy5fZmFsbEJlZ2luID0gcGVyZk5vdygpO1xuICAgIHRoaXMuX2ZhbGxFbmQgPSBwZXJmTm93KCk7XG4gICAgdGhpcy5fZmFsbER1cmF0aW9uID0gMDtcbiAgICB0aGlzLl9pc0ZhbGxpbmcgPSBmYWxzZTtcblxuICAgIC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09IGd5ciBpbnRlbnNpdHlcbiAgICB0aGlzLl9neXJMYXN0ID0gW1xuICAgICAgWzAsIDAsIDBdLFxuICAgICAgWzAsIDAsIDBdLFxuICAgICAgWzAsIDAsIDBdXG4gICAgXTtcbiAgICB0aGlzLl9neXJJbnRlbnNpdHlMYXN0ID0gW1xuICAgICAgWzAsIDBdLFxuICAgICAgWzAsIDBdLFxuICAgICAgWzAsIDBdXG4gICAgXTtcbiAgICB0aGlzLl9neXJJbnRlbnNpdHkgPSBbMCwgMCwgMF07XG4gICAgdGhpcy5fZ3lySW50ZW5zaXR5Tm9ybSA9IDA7XG5cbiAgICAvLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSBraWNrXG4gICAgdGhpcy5fa2lja0ludGVuc2l0eSA9IDA7XG4gICAgdGhpcy5fbGFzdEtpY2sgPSAwO1xuICAgIHRoaXMuX2lzS2lja2luZyA9IGZhbHNlO1xuICAgIHRoaXMuX21lZGlhblZhbHVlcyA9IFswLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwXTtcbiAgICB0aGlzLl9tZWRpYW5MaW5raW5nID0gWzMsIDQsIDEsIDUsIDcsIDgsIDAsIDIsIDZdO1xuICAgIHRoaXMuX21lZGlhbkZpZm8gPSBbNiwgMiwgNywgMCwgMSwgMywgOCwgNCwgNV07XG4gICAgdGhpcy5faTEgPSAwO1xuICAgIHRoaXMuX2kyID0gMDtcbiAgICB0aGlzLl9pMyA9IDA7XG4gICAgdGhpcy5fYWNjSW50ZW5zaXR5Tm9ybU1lZGlhbiA9IDA7XG5cbiAgICAvLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09IHNoYWtlXG4gICAgdGhpcy5fYWNjRGVsdGEgPSBbMCwgMCwgMF07XG4gICAgdGhpcy5fc2hha2VXaW5kb3cgPSBbXG4gICAgICBuZXcgQXJyYXkodGhpcy5fcGFyYW1zLnNoYWtlV2luZG93U2l6ZSksXG4gICAgICBuZXcgQXJyYXkodGhpcy5fcGFyYW1zLnNoYWtlV2luZG93U2l6ZSksXG4gICAgICBuZXcgQXJyYXkodGhpcy5fcGFyYW1zLnNoYWtlV2luZG93U2l6ZSlcbiAgICBdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMzsgaSsrKSB7XG4gICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHRoaXMuX3BhcmFtcy5zaGFrZVdpbmRvd1NpemU7IGorKykge1xuICAgICAgICB0aGlzLl9zaGFrZVdpbmRvd1tpXVtqXSA9IDA7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuX3NoYWtlTmIgPSBbMCwgMCwgMF07XG4gICAgdGhpcy5fc2hha2luZ1JhdyA9IDA7XG4gICAgdGhpcy5fc2hha2VTbGlkZVByZXYgPSAwO1xuICAgIHRoaXMuX3NoYWtpbmcgPSAwO1xuXG4gICAgLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gc3BpblxuICAgIHRoaXMuX3NwaW5CZWdpbiA9IHBlcmZOb3coKTtcbiAgICB0aGlzLl9zcGluRW5kID0gcGVyZk5vdygpO1xuICAgIHRoaXMuX3NwaW5EdXJhdGlvbiA9IDA7XG4gICAgdGhpcy5faXNTcGlubmluZyA9IGZhbHNlO1xuXG4gICAgLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSBzdGlsbFxuICAgIHRoaXMuX3N0aWxsQ3Jvc3NQcm9kID0gMDtcbiAgICB0aGlzLl9zdGlsbFNsaWRlID0gMDtcbiAgICB0aGlzLl9zdGlsbFNsaWRlUHJldiA9IDA7XG4gICAgdGhpcy5faXNTdGlsbCA9IGZhbHNlO1xuXG4gICAgdGhpcy5fbG9vcEluZGV4UGVyaW9kID0gdGhpcy5fbGNtKFxuICAgICAgdGhpcy5fbGNtKFxuICAgICAgICB0aGlzLl9sY20oMiwgMyksIHRoaXMuX3BhcmFtcy5raWNrTWVkaWFuRmlsdGVyc2l6ZVxuICAgICAgKSxcbiAgICAgIHRoaXMuX3BhcmFtcy5zaGFrZVdpbmRvd1NpemVcbiAgICApO1xuICAgIC8vY29uc29sZS5sb2codGhpcy5fbG9vcEluZGV4UGVyaW9kKTtcbiAgICB0aGlzLl9sb29wSW5kZXggPSAwO1xuICB9XG5cbiAgLy89PT09PT09PT09IGludGVyZmFjZSA9PT09PT09PT0vL1xuXG4gIC8qKlxuICAgKiBzU2V0cyB0aGUgY3VycmVudCBhY2NlbGVyb21ldGVyIHZhbHVlcy5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IHggLSB0aGUgYWNjZWxlcm9tZXRlcidzIHggdmFsdWVcbiAgICogQHBhcmFtIHtOdW1iZXJ9IHkgLSB0aGUgYWNjZWxlcm9tZXRlcidzIHkgdmFsdWVcbiAgICogQHBhcmFtIHtOdW1iZXJ9IHogLSB0aGUgYWNjZWxlcm9tZXRlcidzIHogdmFsdWVcbiAgICovXG4gIHNldEFjY2VsZXJvbWV0ZXIoeCwgeSwgeikge1xuICAgIHRoaXMuYWNjWzBdID0geDtcbiAgICB0aGlzLmFjY1sxXSA9IHk7XG4gICAgdGhpcy5hY2NbMl0gPSB6O1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIGN1cnJlbnQgZ3lyb3Njb3BlIHZhbHVlcy5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IHggLSB0aGUgZ3lyb3Njb3BlJ3MgeCB2YWx1ZVxuICAgKiBAcGFyYW0ge051bWJlcn0geSAtIHRoZSBneXJvc2NvcGUncyB5IHZhbHVlXG4gICAqIEBwYXJhbSB7TnVtYmVyfSB6IC0gdGhlIGd5cm9zY29wZSdzIHogdmFsdWVcbiAgICovXG4gIHNldEd5cm9zY29wZSh4LCB5LCB6KSB7XG4gICAgdGhpcy5neXJbMF0gPSB4O1xuICAgIHRoaXMuZ3lyWzFdID0geTtcbiAgICB0aGlzLmd5clsyXSA9IHo7XG4gICAgaWYgKHRoaXMuX3BhcmFtcy5neXJJc0luRGVncmVlcykge1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAzOyBpKyspIHtcbiAgICAgICAgdGhpcy5neXJbaV0gKj0gKDIgKiBNYXRoLlBJIC8gMzYwLik7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEludGVuc2l0eSBvZiB0aGUgbW92ZW1lbnQgc2Vuc2VkIGJ5IGFuIGFjY2VsZXJvbWV0ZXIuXG4gICAqIEB0eXBlZGVmIGFjY0ludGVuc2l0eVxuICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgKiBAcHJvcGVydHkge051bWJlcn0gbm9ybSAtIHRoZSBnbG9iYWwgZW5lcmd5IGNvbXB1dGVkIG9uIGFsbCBkaW1lbnNpb25zLlxuICAgKiBAcHJvcGVydHkge051bWJlcn0geCAtIHRoZSBlbmVyZ3kgaW4gdGhlIHggKGZpcnN0KSBkaW1lbnNpb24uXG4gICAqIEBwcm9wZXJ0eSB7TnVtYmVyfSB5IC0gdGhlIGVuZXJneSBpbiB0aGUgeSAoc2Vjb25kKSBkaW1lbnNpb24uXG4gICAqIEBwcm9wZXJ0eSB7TnVtYmVyfSB6IC0gdGhlIGVuZXJneSBpbiB0aGUgeiAodGhpcmQpIGRpbWVuc2lvbi5cbiAgICovXG5cbiAgLyoqXG4gICAqIEludGVuc2l0eSBvZiB0aGUgbW92ZW1lbnQgc2Vuc2VkIGJ5IGEgZ3lyb3Njb3BlLlxuICAgKiBAdHlwZWRlZiBneXJJbnRlbnNpdHlcbiAgICogQHR5cGUge09iamVjdH1cbiAgICogQHByb3BlcnR5IHtOdW1iZXJ9IG5vcm0gLSB0aGUgZ2xvYmFsIGVuZXJneSBjb21wdXRlZCBvbiBhbGwgZGltZW5zaW9ucy5cbiAgICogQHByb3BlcnR5IHtOdW1iZXJ9IHggLSB0aGUgZW5lcmd5IGluIHRoZSB4IChmaXJzdCkgZGltZW5zaW9uLlxuICAgKiBAcHJvcGVydHkge051bWJlcn0geSAtIHRoZSBlbmVyZ3kgaW4gdGhlIHkgKHNlY29uZCkgZGltZW5zaW9uLlxuICAgKiBAcHJvcGVydHkge051bWJlcn0geiAtIHRoZSBlbmVyZ3kgaW4gdGhlIHogKHRoaXJkKSBkaW1lbnNpb24uXG4gICAqL1xuXG4gIC8qKlxuICAgKiBJbmZvcm1hdGlvbiBhYm91dCB0aGUgZnJlZSBmYWxsaW5nIHN0YXRlIG9mIHRoZSBzZW5zb3IuXG4gICAqIEB0eXBlZGVmIGZyZWVmYWxsXG4gICAqIEB0eXBlIHtPYmplY3R9XG4gICAqIEBwcm9wZXJ0eSB7TnVtYmVyfSBhY2NOb3JtIC0gdGhlIG5vcm0gb2YgdGhlIGFjY2VsZXJhdGlvbi5cbiAgICogQHByb3BlcnR5IHtCb29sZWFufSBmYWxsaW5nIC0gdHJ1ZSBpZiB0aGUgc2Vuc29yIGlzIGZyZWUgZmFsbGluZywgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgKiBAcHJvcGVydHkge051bWJlcn0gZHVyYXRpb24gLSB0aGUgZHVyYXRpb24gb2YgdGhlIGZyZWUgZmFsbGluZyBzaW5jZSBpdHMgYmVnaW5uaW5nLlxuICAgKi9cblxuICAvKipcbiAgICogSW1wdWxzZSAvIGhpdCBtb3ZlbWVudCBkZXRlY3Rpb24gaW5mb3JtYXRpb24uXG4gICAqIEB0eXBlZGVmIGtpY2tcbiAgICogQHR5cGUge09iamVjdH1cbiAgICogQHByb3BlcnR5IHtOdW1iZXJ9IGludGVuc2l0eSAtIHRoZSBjdXJyZW50IGludGVuc2l0eSBvZiB0aGUgXCJraWNrXCIgZ2VzdHVyZS5cbiAgICogQHByb3BlcnR5IHtCb29sZWFufSBraWNraW5nIC0gdHJ1ZSBpZiBhIFwia2lja1wiIGdlc3R1cmUgaXMgYmVpbmcgZGV0ZWN0ZWQsIGZhbHNlIG90aGVyd2lzZS5cbiAgICovXG5cbiAgLyoqXG4gICAqIFNoYWtlIG1vdmVtZW50IGRldGVjdGlvbiBpbmZvcm1hdGlvbi5cbiAgICogQHR5cGVkZWYgc2hha2VcbiAgICogQHR5cGUge09iamVjdH1cbiAgICogQHByb3BlcnR5IHtOdW1iZXJ9IHNoYWtpbmcgLSB0aGUgY3VycmVudCBhbW91bnQgb2YgXCJzaGFraW5lc3NcIi5cbiAgICovXG5cbiAgLyoqXG4gICAqIEluZm9ybWF0aW9uIGFib3V0IHRoZSBzcGlubmluZyBzdGF0ZSBvZiB0aGUgc2Vuc29yLlxuICAgKiBAdHlwZWRlZiBzcGluXG4gICAqIEB0eXBlIHtPYmplY3R9XG4gICAqIEBwcm9wZXJ0eSB7Qm9vbGVhbn0gc3Bpbm5pbmcgLSB0cnVlIGlmIHRoZSBzZW5zb3IgaXMgc3Bpbm5pbmcsIGZhbHNlIG90aGVyd2lzZS5cbiAgICogQHByb3BlcnR5IHtOdW1iZXJ9IGR1cmF0aW9uIC0gdGhlIGR1cmF0aW9uIG9mIHRoZSBzcGlubmluZyBzaW5jZSBpdHMgYmVnaW5uaW5nLlxuICAgKiBAcHJvcGVydHkge051bWJlcn0gZ3lyTm9ybSAtIHRoZSBub3JtIG9mIHRoZSByb3RhdGlvbiBzcGVlZC5cbiAgICovXG5cbiAgLyoqXG4gICAqIEluZm9ybWF0aW9uIGFib3V0IHRoZSBzdGlsbG5lc3Mgb2YgdGhlIHNlbnNvci5cbiAgICogQHR5cGVkZWYgc3RpbGxcbiAgICogQHR5cGUge09iamVjdH1cbiAgICogQHByb3BlcnR5IHtCb29sZWFufSBzdGlsbCAtIHRydWUgaWYgdGhlIHNlbnNvciBpcyBzdGlsbCwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgKiBAcHJvcGVydHkge051bWJlcn0gc2xpZGUgLSB0aGUgb3JpZ2luYWwgdmFsdWUgdGhyZXNob2xkZWQgdG8gZGV0ZXJtaW5lIHN0aWxsbmVzcy5cbiAgICovXG5cbiAgLyoqXG4gICAqIENvbXB1dGVkIGZlYXR1cmVzLlxuICAgKiBAdHlwZWRlZiBmZWF0dXJlc1xuICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgKiBAcHJvcGVydHkge2FjY0ludGVuc2l0eX0gYWNjSW50ZW5zaXR5IC0gSW50ZW5zaXR5IG9mIHRoZSBtb3ZlbWVudCBzZW5zZWQgYnkgYW4gYWNjZWxlcm9tZXRlci5cbiAgICogQHByb3BlcnR5IHtneXJJbnRlbnNpdHl9IGd5ckludGVuc2l0eSAtIEludGVuc2l0eSBvZiB0aGUgbW92ZW1lbnQgc2Vuc2VkIGJ5IGEgZ3lyb3Njb3BlLlxuICAgKiBAcHJvcGVydHkge2ZyZWVmYWxsfSBmcmVlZmFsbCAtIEluZm9ybWF0aW9uIGFib3V0IHRoZSBmcmVlIGZhbGxpbmcgc3RhdGUgb2YgdGhlIHNlbnNvci5cbiAgICogQHByb3BlcnR5IHtraWNrfSBraWNrIC0gSW1wdWxzZSAvIGhpdCBtb3ZlbWVudCBkZXRlY3Rpb24gaW5mb3JtYXRpb24uXG4gICAqIEBwcm9wZXJ0eSB7c2hha2V9IHNoYWtlIC0gU2hha2UgbW92ZW1lbnQgZGV0ZWN0aW9uIGluZm9ybWF0aW9uLlxuICAgKiBAcHJvcGVydHkge3NwaW59IHNwaW4gLSBJbmZvcm1hdGlvbiBhYm91dCB0aGUgc3Bpbm5pbmcgc3RhdGUgb2YgdGhlIHNlbnNvci5cbiAgICogQHByb3BlcnR5IHtzdGlsbH0gc3RpbGwgLSBJbmZvcm1hdGlvbiBhYm91dCB0aGUgc3RpbGxuZXNzIG9mIHRoZSBzZW5zb3IuXG4gICAqL1xuXG4gIC8qKlxuICAgKiBDYWxsYmFjayBoYW5kbGluZyB0aGUgZmVhdHVyZXMuXG4gICAqIEBjYWxsYmFjayBmZWF0dXJlc0NhbGxiYWNrXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBlcnIgLSBEZXNjcmlwdGlvbiBvZiBhIHBvdGVudGlhbCBlcnJvci5cbiAgICogQHBhcmFtIHtmZWF0dXJlc30gcmVzIC0gT2JqZWN0IGhvbGRpbmcgdGhlIGZlYXR1cmUgdmFsdWVzLlxuICAgKi9cblxuICAvKipcbiAgICogVHJpZ2dlcnMgY29tcHV0YXRpb24gb2YgdGhlIGRlc2NyaXB0b3JzIGZyb20gdGhlIGN1cnJlbnQgc2Vuc29yIHZhbHVlcyBhbmRcbiAgICogcGFzcyB0aGUgcmVzdWx0cyB0byBhIGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7ZmVhdHVyZXNDYWxsYmFja30gW2NhbGxiYWNrPW51bGxdIC0gVGhlIGNhbGxiYWNrIGhhbmRsaW5nIHRoZSBsYXN0IGNvbXB1dGVkIGRlc2NyaXB0b3JzXG4gICAqIEByZXR1cm5zIHtmZWF0dXJlc30gZmVhdHVyZXMgLSBSZXR1cm4gdGhlc2UgY29tcHV0ZWQgZGVzY3JpcHRvcnMgYW55d2F5XG4gICAqL1xuICB1cGRhdGUoY2FsbGJhY2sgPSBudWxsKSB7XG4gICAgLy8gREVBTCBXSVRIIHRoaXMuX2VsYXBzZWRUaW1lXG4gICAgdGhpcy5fZWxhcHNlZFRpbWUgPSBwZXJmTm93KCk7XG4gICAgLy8gaXMgdGhpcyBvbmUgdXNlZCBieSBzZXZlcmFsIGZlYXR1cmVzID9cbiAgICB0aGlzLl9hY2NOb3JtID0gdGhpcy5fbWFnbml0dWRlM0QodGhpcy5hY2MpO1xuICAgIC8vIHRoaXMgb25lIG5lZWRzIGJlIGhlcmUgYmVjYXVzZSB1c2VkIGJ5IGZyZWVmYWxsIEFORCBzcGluXG4gICAgdGhpcy5fZ3lyTm9ybSA9IHRoaXMuX21hZ25pdHVkZTNEKHRoaXMuZ3lyKTtcbiAgICBcbiAgICBsZXQgZXJyID0gbnVsbDtcbiAgICBsZXQgcmVzID0gbnVsbDtcbiAgICB0cnkge1xuICAgICAgcmVzID0ge307XG4gICAgICBmb3IgKGxldCBrZXkgb2YgdGhpcy5fcGFyYW1zLmRlc2NyaXB0b3JzKSB7XG4gICAgICAgIGlmICh0aGlzLl9tZXRob2RzW2tleV0pIHtcbiAgICAgICAgICB0aGlzLl9tZXRob2RzW2tleV0ocmVzKTtcbiAgICAgICAgfVxuICAgICAgfSBcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBlcnIgPSBlO1xuICAgIH1cblxuICAgIHRoaXMuX2xvb3BJbmRleCA9ICh0aGlzLl9sb29wSW5kZXggKyAxKSAlIHRoaXMuX2xvb3BJbmRleFBlcmlvZDtcblxuICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgY2FsbGJhY2soZXJyLCByZXMpOyAgXG4gICAgfVxuICAgIHJldHVybiByZXM7XG4gIH1cblxuICAvLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ly9cbiAgLy89PT09PT09PT09PT09PT09PT09PT09IHNwZWNpZmljIGRlc2NyaXB0b3JzIGNvbXB1dGluZyA9PT09PT09PT09PT09PT09PT09PS8vXG4gIC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0vL1xuXG4gIC8qKiBAcHJpdmF0ZSAqL1xuICBfdXBkYXRlQWNjUmF3KHJlcykge1xuICAgIHJlcy5hY2NSYXcgPSB7XG4gICAgICB4OiB0aGlzLmFjY1swXSxcbiAgICAgIHk6IHRoaXMuYWNjWzFdLFxuICAgICAgejogdGhpcy5hY2NbMl1cbiAgICB9O1xuICB9XG5cbiAgLyoqIEBwcml2YXRlICovXG4gIF91cGRhdGVHeXJSYXcocmVzKSB7XG4gICAgcmVzLmd5clJhdyA9IHtcbiAgICAgIHg6IHRoaXMuZ3lyWzBdLFxuICAgICAgeTogdGhpcy5neXJbMV0sXG4gICAgICB6OiB0aGlzLmd5clsyXVxuICAgIH07XG4gIH1cblxuICAvLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09IGFjYyBpbnRlbnNpdHlcbiAgLyoqIEBwcml2YXRlICovXG4gIF91cGRhdGVBY2NJbnRlbnNpdHkocmVzKSB7XG4gICAgdGhpcy5fYWNjSW50ZW5zaXR5Tm9ybSA9IDA7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDM7IGkrKykge1xuICAgICAgdGhpcy5fYWNjTGFzdFtpXVt0aGlzLl9sb29wSW5kZXggJSAzXSA9IHRoaXMuYWNjW2ldO1xuXG4gICAgICB0aGlzLl9hY2NJbnRlbnNpdHlbaV0gPSB0aGlzLl9pbnRlbnNpdHkxRChcbiAgICAgICAgdGhpcy5hY2NbaV0sXG4gICAgICAgIHRoaXMuX2FjY0xhc3RbaV1bKHRoaXMuX2xvb3BJbmRleCArIDEpICUgM10sXG4gICAgICAgIHRoaXMuX2FjY0ludGVuc2l0eUxhc3RbaV1bKHRoaXMuX2xvb3BJbmRleCArIDEpICUgMl0sXG4gICAgICAgIHRoaXMuX3BhcmFtcy5hY2NJbnRlbnNpdHlQYXJhbTEsXG4gICAgICAgIHRoaXMuX3BhcmFtcy5hY2NJbnRlbnNpdHlQYXJhbTIsXG4gICAgICAgIDFcbiAgICAgICk7XG5cbiAgICAgIHRoaXMuX2FjY0ludGVuc2l0eUxhc3RbaV1bdGhpcy5fbG9vcEluZGV4ICUgMl0gPSB0aGlzLl9hY2NJbnRlbnNpdHlbaV07XG5cbiAgICAgIHRoaXMuX2FjY0ludGVuc2l0eU5vcm0gKz0gdGhpcy5fYWNjSW50ZW5zaXR5W2ldO1xuICAgIH1cblxuICAgIHJlcy5hY2NJbnRlbnNpdHkgPSB7XG4gICAgICBub3JtOiB0aGlzLl9hY2NJbnRlbnNpdHlOb3JtLFxuICAgICAgeDogdGhpcy5fYWNjSW50ZW5zaXR5WzBdLFxuICAgICAgeTogdGhpcy5fYWNjSW50ZW5zaXR5WzFdLFxuICAgICAgejogdGhpcy5fYWNjSW50ZW5zaXR5WzJdXG4gICAgfTtcbiAgfVxuXG4gIC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gZ3lyIGludGVuc2l0eVxuICAvKiogQHByaXZhdGUgKi9cbiAgX3VwZGF0ZUd5ckludGVuc2l0eShyZXMpIHtcbiAgICB0aGlzLl9neXJJbnRlbnNpdHlOb3JtID0gMDtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMzsgaSsrKSB7XG4gICAgICB0aGlzLl9neXJMYXN0W2ldW3RoaXMuX2xvb3BJbmRleCAlIDNdID0gdGhpcy5neXJbaV07XG5cbiAgICAgIHRoaXMuX2d5ckludGVuc2l0eVtpXSA9IHRoaXMuX2ludGVuc2l0eTFEKFxuICAgICAgICB0aGlzLmd5cltpXSxcbiAgICAgICAgdGhpcy5fZ3lyTGFzdFtpXVsodGhpcy5fbG9vcEluZGV4ICsgMSkgJSAzXSxcbiAgICAgICAgdGhpcy5fZ3lySW50ZW5zaXR5TGFzdFtpXVsodGhpcy5fbG9vcEluZGV4ICsgMSkgJSAyXSxcbiAgICAgICAgdGhpcy5fcGFyYW1zLmd5ckludGVuc2l0eVBhcmFtMSxcbiAgICAgICAgdGhpcy5fcGFyYW1zLmd5ckludGVuc2l0eVBhcmFtMixcbiAgICAgICAgMVxuICAgICAgKTtcblxuICAgICAgdGhpcy5fZ3lySW50ZW5zaXR5TGFzdFtpXVt0aGlzLl9sb29wSW5kZXggJSAyXSA9IHRoaXMuX2d5ckludGVuc2l0eVtpXTtcblxuICAgICAgdGhpcy5fZ3lySW50ZW5zaXR5Tm9ybSArPSB0aGlzLl9neXJJbnRlbnNpdHlbaV07XG4gICAgfVxuXG4gICAgcmVzLmd5ckludGVuc2l0eSA9IHtcbiAgICAgIG5vcm06IHRoaXMuX2d5ckludGVuc2l0eU5vcm0sXG4gICAgICB4OiB0aGlzLl9neXJJbnRlbnNpdHlbMF0sXG4gICAgICB5OiB0aGlzLl9neXJJbnRlbnNpdHlbMV0sXG4gICAgICB6OiB0aGlzLl9neXJJbnRlbnNpdHlbMl1cbiAgICB9O1xuICB9XG5cbiAgLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09IGZyZWVmYWxsXG4gIC8qKiBAcHJpdmF0ZSAqL1xuICBfdXBkYXRlRnJlZWZhbGwocmVzKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCAzOyBpKyspIHtcbiAgICAgIHRoaXMuX2d5ckRlbHRhW2ldID1cbiAgICAgICAgdGhpcy5fZGVsdGEodGhpcy5fZ3lyTGFzdFtpXVsodGhpcy5fbG9vcEluZGV4ICsgMSkgJSAzXSwgdGhpcy5neXJbaV0sIDEpO1xuICAgIH1cblxuICAgIHRoaXMuX2d5ckRlbHRhTm9ybSA9IHRoaXMuX21hZ25pdHVkZTNEKHRoaXMuX2d5ckRlbHRhKTtcblxuICAgIGlmICh0aGlzLl9hY2NOb3JtIDwgdGhpcy5fcGFyYW1zLmZyZWVmYWxsQWNjVGhyZXNoIHx8XG4gICAgICAgICh0aGlzLl9neXJOb3JtID4gdGhpcy5fcGFyYW1zLmZyZWVmYWxsR3lyVGhyZXNoXG4gICAgICAgICAgJiYgdGhpcy5fZ3lyRGVsdGFOb3JtIDwgdGhpcy5fcGFyYW1zLmZyZWVmYWxsR3lyRGVsdGFUaHJlc2gpKSB7XG4gICAgICBpZiAoIXRoaXMuX2lzRmFsbGluZykge1xuICAgICAgICB0aGlzLl9pc0ZhbGxpbmcgPSB0cnVlO1xuICAgICAgICB0aGlzLl9mYWxsQmVnaW4gPSBwZXJmTm93KCk7XG4gICAgICB9XG4gICAgICB0aGlzLl9mYWxsRW5kID0gcGVyZk5vdygpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAodGhpcy5faXNGYWxsaW5nKSB7XG4gICAgICAgIHRoaXMuX2lzRmFsbGluZyA9IGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLl9mYWxsRHVyYXRpb24gPSAodGhpcy5fZmFsbEVuZCAtIHRoaXMuX2ZhbGxCZWdpbik7XG5cbiAgICByZXMuZnJlZWZhbGwgPSB7XG4gICAgICBhY2NOb3JtOiB0aGlzLl9hY2NOb3JtLFxuICAgICAgZmFsbGluZzogdGhpcy5faXNGYWxsaW5nLFxuICAgICAgZHVyYXRpb246IHRoaXMuX2ZhbGxEdXJhdGlvblxuICAgIH07XG4gIH1cblxuICAvLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09IGtpY2tcbiAgLyoqIEBwcml2YXRlICovXG4gIF91cGRhdGVLaWNrKHJlcykge1xuICAgIHRoaXMuX2kzID0gdGhpcy5fbG9vcEluZGV4ICUgdGhpcy5fcGFyYW1zLmtpY2tNZWRpYW5GaWx0ZXJzaXplO1xuICAgIHRoaXMuX2kxID0gdGhpcy5fbWVkaWFuRmlmb1t0aGlzLl9pM107XG4gICAgdGhpcy5faTIgPSAxO1xuXG4gICAgaWYgKHRoaXMuX2kxIDwgdGhpcy5fcGFyYW1zLmtpY2tNZWRpYW5GaWx0ZXJzaXplICYmXG4gICAgICAgIHRoaXMuX2FjY0ludGVuc2l0eU5vcm0gPiB0aGlzLl9tZWRpYW5WYWx1ZXNbdGhpcy5faTEgKyB0aGlzLl9pMl0pIHtcbiAgICAgIC8vIGNoZWNrIHJpZ2h0XG4gICAgICB3aGlsZSAodGhpcy5faTEgKyB0aGlzLl9pMiA8IHRoaXMua2lja01lZGlhbkZpbHRlcnNpemUgJiZcbiAgICAgICAgICAgICAgdGhpcy5fYWNjSW50ZW5zaXR5Tm9ybSA+IHRoaXMuX21lZGlhblZhbHVlc1t0aGlzLl9pMSArIHRoaXMuX2kyXSkge1xuICAgICAgICB0aGlzLl9tZWRpYW5GaWZvW3RoaXMuX21lZGlhbkxpbmtpbmdbdGhpcy5faTEgKyB0aGlzLl9pMl1dID0gXG4gICAgICAgIHRoaXMuX21lZGlhbkZpZm9bdGhpcy5fbWVkaWFuTGlua2luZ1t0aGlzLl9pMSArIHRoaXMuX2kyXV0gLSAxO1xuICAgICAgICB0aGlzLl9tZWRpYW5WYWx1ZXNbdGhpcy5faTEgKyB0aGlzLl9pMiAtIDFdID1cbiAgICAgICAgdGhpcy5fbWVkaWFuVmFsdWVzW3RoaXMuX2kxICsgdGhpcy5faTJdO1xuICAgICAgICB0aGlzLl9tZWRpYW5MaW5raW5nW3RoaXMuX2kxICsgdGhpcy5faTIgLSAxXSA9XG4gICAgICAgIHRoaXMuX21lZGlhbkxpbmtpbmdbdGhpcy5faTEgKyB0aGlzLl9pMl07XG4gICAgICAgIHRoaXMuX2kyKys7XG4gICAgICB9XG4gICAgICB0aGlzLl9tZWRpYW5WYWx1ZXNbdGhpcy5faTEgKyB0aGlzLl9pMiAtIDFdID0gdGhpcy5fYWNjSW50ZW5zaXR5Tm9ybTtcbiAgICAgIHRoaXMuX21lZGlhbkxpbmtpbmdbdGhpcy5faTEgKyB0aGlzLl9pMiAtIDFdID0gdGhpcy5faTM7XG4gICAgICB0aGlzLl9tZWRpYW5GaWZvW3RoaXMuX2kzXSA9IHRoaXMuX2kxICsgdGhpcy5faTIgLSAxO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBjaGVjayBsZWZ0XG4gICAgICB3aGlsZSAodGhpcy5faTIgPCB0aGlzLl9pMSArIDEgJiZcbiAgICAgICAgICAgICB0aGlzLl9hY2NJbnRlbnNpdHlOb3JtIDwgdGhpcy5fbWVkaWFuVmFsdWVzW3RoaXMuX2kxIC0gdGhpcy5faTJdKSB7XG4gICAgICAgIHRoaXMuX21lZGlhbkZpZm9bdGhpcy5fbWVkaWFuTGlua2luZ1t0aGlzLl9pMSAtIHRoaXMuX2kyXV0gPVxuICAgICAgICB0aGlzLl9tZWRpYW5GaWZvW3RoaXMuX21lZGlhbkxpbmtpbmdbdGhpcy5faTEgLSB0aGlzLl9pMl1dICsgMTtcbiAgICAgICAgdGhpcy5fbWVkaWFuVmFsdWVzW3RoaXMuX2kxIC0gdGhpcy5faTIgKyAxXSA9XG4gICAgICAgIHRoaXMuX21lZGlhblZhbHVlc1t0aGlzLl9pMSAtIHRoaXMuX2kyXTtcbiAgICAgICAgdGhpcy5fbWVkaWFuTGlua2luZ1t0aGlzLl9pMSAtIHRoaXMuX2kyICsgMV0gPVxuICAgICAgICB0aGlzLl9tZWRpYW5MaW5raW5nW3RoaXMuX2kxIC0gdGhpcy5faTJdO1xuICAgICAgICB0aGlzLl9pMisrO1xuICAgICAgfVxuICAgICAgdGhpcy5fbWVkaWFuVmFsdWVzW3RoaXMuX2kxIC0gdGhpcy5faTIgKyAxXSA9IHRoaXMuX2FjY0ludGVuc2l0eU5vcm07XG4gICAgICB0aGlzLl9tZWRpYW5MaW5raW5nW3RoaXMuX2kxIC0gdGhpcy5faTIgKyAxXSA9IHRoaXMuX2kzO1xuICAgICAgdGhpcy5fbWVkaWFuRmlmb1t0aGlzLl9pM10gPSB0aGlzLl9pMSAtIHRoaXMuX2kyICsgMTtcbiAgICB9XG5cbiAgICAvLyBjb21wYXJlIGN1cnJlbnQgaW50ZW5zaXR5IG5vcm0gd2l0aCBwcmV2aW91cyBtZWRpYW4gdmFsdWVcbiAgICBpZiAodGhpcy5fYWNjSW50ZW5zaXR5Tm9ybSAtIHRoaXMuX2FjY0ludGVuc2l0eU5vcm1NZWRpYW4gPiB0aGlzLl9wYXJhbXMua2lja1RocmVzaCkge1xuICAgICAgaWYgKHRoaXMuX2lzS2lja2luZykge1xuICAgICAgICBpZiAodGhpcy5fa2lja0ludGVuc2l0eSA8IHRoaXMuX2FjY0ludGVuc2l0eU5vcm0pIHtcbiAgICAgICAgICB0aGlzLl9raWNrSW50ZW5zaXR5ID0gdGhpcy5fYWNjSW50ZW5zaXR5Tm9ybTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5faXNLaWNraW5nID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fa2lja0ludGVuc2l0eSA9IHRoaXMuX2FjY0ludGVuc2l0eU5vcm07XG4gICAgICAgIHRoaXMuX2xhc3RLaWNrID0gdGhpcy5fZWxhcHNlZFRpbWU7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICh0aGlzLl9lbGFwc2VkVGltZSAtIHRoaXMuX2xhc3RLaWNrID4gdGhpcy5fcGFyYW1zLmtpY2tTcGVlZEdhdGUpIHtcbiAgICAgICAgdGhpcy5faXNLaWNraW5nID0gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fYWNjSW50ZW5zaXR5Tm9ybU1lZGlhbiA9IHRoaXMuX21lZGlhblZhbHVlc1t0aGlzLl9wYXJhbXMua2lja01lZGlhbkZpbHRlcnNpemVdO1xuXG4gICAgcmVzLmtpY2sgPSB7XG4gICAgICBpbnRlbnNpdHk6IHRoaXMuX2tpY2tJbnRlbnNpdHksXG4gICAgICBraWNraW5nOiB0aGlzLl9pc0tpY2tpbmdcbiAgICB9O1xuICB9XG5cbiAgLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09IHNoYWtlXG4gIC8qKiBAcHJpdmF0ZSAqL1xuICBfdXBkYXRlU2hha2UocmVzKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCAzOyBpKyspIHtcbiAgICAgIHRoaXMuX2FjY0RlbHRhW2ldID0gdGhpcy5fZGVsdGEoXG4gICAgICAgIHRoaXMuX2FjY0xhc3RbaV1bKHRoaXMuX2xvb3BJbmRleCArIDEpICUgM10sXG4gICAgICAgIHRoaXMuYWNjW2ldLFxuICAgICAgICAxXG4gICAgICApO1xuICAgIH1cblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMzsgaSsrKSB7XG4gICAgICBpZiAodGhpcy5fc2hha2VXaW5kb3dbaV1bdGhpcy5fbG9vcEluZGV4ICUgdGhpcy5fcGFyYW1zLnNoYWtlV2luZG93U2l6ZV0pIHtcbiAgICAgICAgdGhpcy5fc2hha2VOYltpXS0tO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuX2FjY0RlbHRhW2ldID4gdGhpcy5fcGFyYW1zLnNoYWtlVGhyZXNoKSB7XG4gICAgICAgIHRoaXMuX3NoYWtlV2luZG93W2ldW3RoaXMuX2xvb3BJbmRleCAlIHRoaXMuX3BhcmFtcy5zaGFrZVdpbmRvd1NpemVdID0gMTtcbiAgICAgICAgdGhpcy5fc2hha2VOYltpXSsrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fc2hha2VXaW5kb3dbaV1bdGhpcy5fbG9vcEluZGV4ICUgdGhpcy5fcGFyYW1zLnNoYWtlV2luZG93U2l6ZV0gPSAwO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuX3NoYWtpbmdSYXcgPVxuICAgIHRoaXMuX21hZ25pdHVkZTNEKHRoaXMuX3NoYWtlTmIpIC9cbiAgICB0aGlzLl9wYXJhbXMuc2hha2VXaW5kb3dTaXplO1xuICAgIHRoaXMuX3NoYWtlU2xpZGVQcmV2ID0gdGhpcy5fc2hha2luZztcbiAgICB0aGlzLl9zaGFraW5nID1cbiAgICB0aGlzLl9zbGlkZSh0aGlzLl9zaGFrZVNsaWRlUHJldiwgdGhpcy5fc2hha2luZ1JhdywgdGhpcy5fcGFyYW1zLnNoYWtlU2xpZGVGYWN0b3IpO1xuXG4gICAgcmVzLnNoYWtlID0ge1xuICAgICAgc2hha2luZzogdGhpcy5fc2hha2luZ1xuICAgIH07XG4gIH1cblxuICAvLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09IHNwaW5cbiAgLyoqIEBwcml2YXRlICovXG4gIF91cGRhdGVTcGluKHJlcykge1xuICAgIGlmICh0aGlzLl9neXJOb3JtID4gdGhpcy5fcGFyYW1zLnNwaW5UaHJlc2gpIHtcbiAgICAgIGlmICghdGhpcy5faXNTcGlubmluZykge1xuICAgICAgICB0aGlzLl9pc1NwaW5uaW5nID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fc3BpbkJlZ2luID0gcGVyZk5vdygpO1xuICAgICAgfVxuICAgICAgdGhpcy5fc3BpbkVuZCA9IHBlcmZOb3coKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuX2lzU3Bpbm5pbmcpIHtcbiAgICAgIHRoaXMuX2lzU3Bpbm5pbmcgPSBmYWxzZTtcbiAgICB9XG4gICAgdGhpcy5fc3BpbkR1cmF0aW9uID0gdGhpcy5fc3BpbkVuZCAtIHRoaXMuX3NwaW5CZWdpbjtcblxuICAgIHJlcy5zcGluID0ge1xuICAgICAgc3Bpbm5pbmc6IHRoaXMuX2lzU3Bpbm5pbmcsXG4gICAgICBkdXJhdGlvbjogdGhpcy5fc3BpbkR1cmF0aW9uLFxuICAgICAgZ3lyTm9ybTogdGhpcy5fZ3lyTm9ybVxuICAgIH07XG4gIH1cblxuICAvLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gc3RpbGxcbiAgLyoqIEBwcml2YXRlICovXG4gIF91cGRhdGVTdGlsbChyZXMpIHtcbiAgICB0aGlzLl9zdGlsbENyb3NzUHJvZCA9IHRoaXMuX3N0aWxsQ3Jvc3NQcm9kdWN0KHRoaXMuZ3lyKTtcbiAgICB0aGlzLl9zdGlsbFNsaWRlUHJldiA9IHRoaXMuX3N0aWxsU2xpZGU7XG4gICAgdGhpcy5fc3RpbGxTbGlkZSA9IHRoaXMuX3NsaWRlKFxuICAgICAgdGhpcy5fc3RpbGxTbGlkZVByZXYsXG4gICAgICB0aGlzLl9zdGlsbENyb3NzUHJvZCxcbiAgICAgIHRoaXMuX3BhcmFtcy5zdGlsbFNsaWRlRmFjdG9yXG4gICAgKTtcblxuICAgIGlmICh0aGlzLl9zdGlsbFNsaWRlID4gdGhpcy5fcGFyYW1zLnN0aWxsVGhyZXNoKSB7XG4gICAgICB0aGlzLl9pc1N0aWxsID0gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2lzU3RpbGwgPSB0cnVlO1xuICAgIH1cbiAgXG4gICAgcmVzLnN0aWxsID0ge1xuICAgICAgc3RpbGw6IHRoaXMuX2lzU3RpbGwsXG4gICAgICBzbGlkZTogdGhpcy5fc3RpbGxTbGlkZVxuICAgIH1cbiAgfVxuXG4gIC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0vL1xuICAvLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09IFVUSUxJVElFUyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ly9cbiAgLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PS8vXG4gIC8qKiBAcHJpdmF0ZSAqL1xuICBfZGVsdGEocHJldiwgbmV4dCwgZHQpIHtcbiAgICByZXR1cm4gKG5leHQgLSBwcmV2KSAvICgyICogZHQpO1xuICB9XG5cbiAgLyoqIEBwcml2YXRlICovXG4gIF9pbnRlbnNpdHkxRChuZXh0WCwgcHJldlgsIHByZXZJbnRlbnNpdHksIHBhcmFtMSwgcGFyYW0yLCBkdCkge1xuICAgIGNvbnN0IGR4ID0gdGhpcy5fZGVsdGEobmV4dFgsIHByZXZYLCBkdCk7Ly8obmV4dFggLSBwcmV2WCkgLyAoMiAqIGR0KTtcbiAgICByZXR1cm4gcGFyYW0yICogZHggKiBkeCArIHBhcmFtMSAqIHByZXZJbnRlbnNpdHk7XG4gIH1cblxuICAvKiogQHByaXZhdGUgKi9cbiAgX21hZ25pdHVkZTNEKHh5ekFycmF5KSB7XG4gICAgcmV0dXJuIE1hdGguc3FydCh4eXpBcnJheVswXSAqIHh5ekFycmF5WzBdICsgXG4gICAgICAgICAgICAgICAgeHl6QXJyYXlbMV0gKiB4eXpBcnJheVsxXSArXG4gICAgICAgICAgICAgICAgeHl6QXJyYXlbMl0gKiB4eXpBcnJheVsyXSk7XG4gIH1cblxuICAvKiogQHByaXZhdGUgKi9cbiAgX2xjbShhLCBiKSB7XG4gICAgbGV0IGExID0gYSwgYjEgPSBiO1xuXG4gICAgd2hpbGUgKGExICE9IGIxKSB7XG4gICAgICBpZiAoYTEgPCBiMSkge1xuICAgICAgICBhMSArPSBhO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYjEgKz0gYjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gYTE7XG4gIH1cblxuICAvKiogQHByaXZhdGUgKi9cbiAgX3NsaWRlKHByZXZTbGlkZSwgY3VycmVudFZhbCwgc2xpZGVGYWN0b3IpIHtcbiAgICByZXR1cm4gcHJldlNsaWRlICsgKGN1cnJlbnRWYWwgLSBwcmV2U2xpZGUpIC8gc2xpZGVGYWN0b3I7XG4gIH1cblxuICAvKiogQHByaXZhdGUgKi9cbiAgX3N0aWxsQ3Jvc3NQcm9kdWN0KHh5ekFycmF5KSB7XG4gICAgcmV0dXJuICh4eXpBcnJheVsxXSAtIHh5ekFycmF5WzJdKSAqICh4eXpBcnJheVsxXSAtIHh5ekFycmF5WzJdKSArXG4gICAgICAgICAgICh4eXpBcnJheVswXSAtIHh5ekFycmF5WzFdKSAqICh4eXpBcnJheVswXSAtIHh5ekFycmF5WzFdKSArXG4gICAgICAgICAgICh4eXpBcnJheVsyXSAtIHh5ekFycmF5WzBdKSAqICh4eXpBcnJheVsyXSAtIHh5ekFycmF5WzBdKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNb3Rpb25GZWF0dXJlcztcbiJdfQ==