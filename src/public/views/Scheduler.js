import React, { Component } from 'react';
import { Link } from 'react-router'
import _ from 'lodash';

// require('../func/html2canvas');

import CourseList from '../containers/CourseList';
import Calendar from '../containers/Calendar';
import SelectorFilter from '../containers/SelectorFilter';

import colors from '../func/colors';

import api from '../api-interface';

class Scheduler extends Component {

  constructor(props) {
    super(props);
    // let uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    //   var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    //   return v.toString(16);
    // });
    this.state = {
      courses: [],
      courseData: {},
      combinations: [],
      anchors: {},
      blocks: [],
      colors: [],
      index: 0,
      ghostIndex: null,
      hover: null,
      enabled: true,
      loading: true,
      email: props.params.userEmail.toLowerCase()
    };
    this.socket = io();
    this.addClass = this.addClass.bind(this);
    this.removeClass = this.removeClass.bind(this);
    this.setHover = this.setHover.bind(this);
    this.toggleAnchor = this.toggleAnchor.bind(this);
    this.generateSchedules = this.generateSchedules.bind(this);
    this.uploadImage = this.uploadImage.bind(this);
    this.updateCal = this.updateCal.bind(this);
    this.updateGhostIndex = this.updateGhostIndex.bind(this);
    this.addBlock = this.addBlock.bind(this);
    this.removeBlock = this.removeBlock.bind(this);
  }

  render() {

    let { enabled, courses, courseData, combinations,
          anchors, colors, index, hover, ghostIndex, blocks } = this.state;

    if (enabled) {
      return (
        <main>
          <CourseList
            courses={courses}
            courseData={courseData}
            combinations={combinations}
            addClass={this.addClass}
            removeClass={this.removeClass}
            anchors={anchors}
            hoverIndex={hover}
            setHover={this.setHover}
            colors={colors}
            loading={this.state.loading}
          />
          <Calendar
            courses={courses}
            courseData={courseData}
            combinations={combinations}
            index={index}
            hoverIndex={hover}
            setHover={this.setHover}
            anchors={anchors}
            toggleAnchor={this.toggleAnchor}
            colors={colors}
            regenerate={this.generateSchedules}
            screenshot={this.uploadImage}
            ghostIndex={ghostIndex}
            addBlock={this.addBlock}
            removeBlock={this.removeBlock}
            blocks={blocks}
          />
          <SelectorFilter
            courses={courses}
            courseData={courseData}
            combinations={combinations}
            index={index}
            updateCal={this.updateCal}
            ghostIndex={ghostIndex}
            updateGhostIndex={this.updateGhostIndex}
          />
          {(() => {

            if (this.state.loading) {
              return (
                <div id="load_msg" style={{
                  zIndex: 100
                }}>
                  <h1 style={{
                    textAlign: 'center',
                    marginTop: 100
                  }}>Loading...</h1>
                </div>);
            }

          })()}
        </main>
      );
    }
    else {
      return (
        <main>
          <h1 style={{
            textAlign: 'center',
            margin: 100
          }}>User does not exist. <Link to={`/`}>Go back.</Link></h1>
        </main>
      );
    }
  }

  componentWillMount() {
    let _this = this;
    api.getUser(this.state.email).then(data =>{
      if ('error' in data) {
        _this.setState({ enabled: false });
      } else {
        _this.setState({
          courses: data.courses || [],
          anchors: data.anchors || {},
          blocks: data.blocks || [],
          loading: false,
        }, _this.generateSchedules);
        api.updateServer().then(()=>{});
      }
    });
  }

  componentDidMount() {
    document.addEventListener('keydown', this.keyboardCommands.bind(this), false);
    let _this = this;
    // sockets
    this.socket.on('receive:courseData', function (courseId) {
      if (_this.state.courses.indexOf(courseId) > -1) {
        _this.generateSchedules();
      }
    });

  }

  updateServer() {
    api.updateUser(this.state.email, this.state.courses, this.state.anchors, this.state.blocks);
  }

  addClass(courseId) {
    let _this = this;

    // don't re-add class
    if (this.state.courses.indexOf(courseId) > -1) return;

    // 1. verify that the course exists
    api.verify(courseId, 20163).then(courseExists => {
      if (courseExists) {
        let coursesList = this.state.courses;
        coursesList.unshift(courseId);
        _this.setState({ courses: coursesList }, _this.generateSchedules());
      }
    });
  }

  removeClass(courseId) {
    let anchors = this.state.anchors;
    if (anchors[courseId]) {
      delete anchors[courseId];
      this.setState({ anchors });
    }

    this.setState({
      courses: _.pull(this.state.courses, courseId)
    }, this.generateSchedules);
  }

  toggleAnchor(courseId, sectionId) {
    let anchors = this.state.anchors;
    if (anchors[courseId] && anchors[courseId].indexOf(sectionId) >= 0) {
      this.removeAnchor(courseId, sectionId);
    } else {
      this.addAnchor(courseId, sectionId);
    }
  }

  addAnchor(courseId, sectionId) {
    let anchors = this.state.anchors;

    if (!_.isArray(anchors[courseId]))
      anchors[courseId] = [];

    if (anchors[courseId].indexOf(sectionId) >= 0) return;

    anchors[courseId].push(sectionId);
    this.setState({ anchors }, this.generateSchedules);
  }

  removeAnchor(courseId, sectionId) {
    let anchors = this.state.anchors;
    if (!anchors[courseId]) return;
    if (anchors[courseId].indexOf(sectionId) < 0) return;
    anchors[courseId] = _.pull(anchors[courseId], sectionId)
    if (anchors[courseId].length <= 0) {
      delete anchors[courseId];
    }
    this.setState({ anchors }, this.generateSchedules);
  }

  regenerate() {
    this.generateSchedules();
    api.updateServer().then(()=>{});
  }

  generateSchedules() {
    this.updateServer();
    this.generateColors();
    if (this.state.courses.length === 0) {
      this.setState({
        courseData: {},
        combinations: [],
        index: 0
      });
    } else {
      api.generateCourseDataAndSchedules(this.state.courses, this.state.anchors, this.state.blocks)
        .then(({ courseData, results }) => {
          let index = this.state.index;
          if (index >= results.length) index = results.length - 1;
          if (index <= 0) index = 0;
          this.setState({
            courseData,
            combinations: results,
            index
          });
      });
    }
  }

  generateColors() {
    this.setState({
      colors: colors.slice(0).splice(0, this.state.courses.length).reverse()
    });
  }

  uploadImage() {

    // html2canvas(document.body).then(canvas => {
    //
    //   var data = canvas.toDataURL("image/jpeg", 1);
    //   var meta = document.createElement('meta');
    //   meta.property = 'og:image';
    //   meta.content = data;
    //   meta.content = "IE=edge";
    //   document.getElementsByTagName('head')[0].appendChild(meta);
    //   // api.uploadScreenshot(this.state.email, data)
    //   //   .then(result => {
    //   //     console.log(result);
    //   //   });
    // });

    // FB.ui({
    //   method: 'share',
    //   display: 'popup',
    //   href: 'http://hackschedule.com',
    // }, function(response){});

  }

  updateCal(i) {
    this.setState({ index: i });
  }

  updateGhostIndex(i) {
    this.setState({ ghostIndex: i });
  }

  keyboardCommands(e) {
    if([37,38,39,40].indexOf(e.keyCode) > -1){
      e.preventDefault();
      if(e.keyCode == 37 || e.keyCode == 38) this.goPrev();
      else this.goNext();
    }
  }

  goPrev() {
    if (this.state.index > 0) {
      this.setState({ index: this.state.index - 1 });
    }
  }

  goNext() {
    if (this.state.index < this.state.combinations.length - 1) {
      this.setState({ index: this.state.index + 1 });
    } else {
      this.setState({ index: this.state.combinations.length - 1});
    }
  }

  addBlock(start, end, day) {
    let blocks = this.state.blocks;
    blocks.push({ start, end, day });
    this.setState({ blocks }, this.generateSchedules);
  }

  removeBlock(index) {
    let blocks = this.state.blocks;
    blocks.splice(index, 1);
    this.setState({ blocks }, this.generateSchedules);
  }

  setHover(i) {
    this.setState({ hover: i });
  }

};

export default Scheduler;
