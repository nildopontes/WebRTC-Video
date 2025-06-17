const drone = new ScaleDrone('OOgX7u3om3pEfCPf');

// Nome da sala deve ser precedido de 'observable-'
const roomName = 'observable-nildopontes';
const configuration = {
   iceServers: [{
      urls: 'stun:stun.voipstunt.com'
   }]
};
var showLog = false;
var room;
var pc = {};
var stream;
document.addEventListener('DOMContentLoaded', function() {
   onLog('Documento carregado');
   if(location.search == '?log'){
      showLog = true;
      log.style.display = 'initial';
   }
});

function initStream(){
   Object.keys(pc).forEach(key => {
      onLog('Stream enviado para ' + key);
      pc[key].addTrack(stream.getTracks()[0], stream);
      pc[key].addTrack(stream.getTracks()[1], stream);
      pc[key].createOffer().then(offer => {
         pc[key].setLocalDescription(offer).then(() => {
            onLog('Oferta para ' + key);
            sendMessage({'sdp': pc[key].localDescription}, key);
         });
      }).catch(err => onLog(err));
   });
   let video = document.createElement('video');
   video.setAttribute('id', 'local');
   video.setAttribute('autoplay', '');
   video.setAttribute('muted', '');
   video.style.transform = 'scaleX(-1)';
   video.srcObject = stream;
   document.body.appendChild(video);
   setVideoLayout();
}

function addMember(member){
   onLog(member + ' adicionado');
   let pcn = new RTCPeerConnection(configuration);
   pcn.onicecandidate = event => {
      if(event.candidate){
         onLog('icecandidate para ' + member);
         sendMessage({'candidate': event.candidate}, member);
      }
   };
   pcn.ontrack = event => {
      onLog('Stream de ' + member);
      const stream = event.streams[0];
      let video = document.getElementById(member);
      if(!video){
         video = document.createElement('video');
         video.setAttribute('id', member);
         video.setAttribute('autoplay', '');
      }
      video.srcObject = stream;
      document.body.appendChild(video);
      setVideoLayout();
   };
   pc[member] = pcn;
}

navigator.mediaDevices.getUserMedia({audio: true, video: true}).then(s => {
   stream = s;
   document.getElementById('call').removeAttribute('disabled');
}, onLog);

// Ajusta o estilo dos videos conforme a quantidade de clientes online
function setVideoLayout(){
   let local = document.getElementById('local');
   let remotes = [];
   Object.keys(pc).forEach(key => {
      let v = document.getElementById(key);
      if(v) remotes.push(v);
   });
   switch(remotes.length){
      case 0:{
         if(local) local.className = 'fullscreen';
         break;
      }
      case 1:{
         if(local) local.className = 'thumbnail';
         Object.keys(pc).forEach(key => {
            document.getElementById(key).className = 'fullscreen';
         });
         break;
      }
      case 2:{
         if(local) local.className = 'group';
         Object.keys(pc).forEach(key => {
            document.getElementById(key).className = 'group';
         });
         break;
      }
      case 3:{
         if(local) local.className = 'group';
         Object.keys(pc).forEach(key => {
            document.getElementById(key).className = 'group';
         });
         break;
      }
   }
}

function onLog(msg){
   if(!showLog) return;
   log.value += msg + '\n';
};

drone.on('open', error => {
   if(error){
      onLog(error);
      return;
   }
   room = drone.subscribe(roomName);
   room.on('open', error => {
      if(error){
         onLog(error);
      }
   });
   // Evento que dispara somente 1 vez ao entrar na sala. Retorna os membros online
   room.on('members', members => {
      onLog('Entrei na sala com id = ' + drone.clientId);
      if(members.length > 1){
         members.forEach(member => {
            if(member.id != drone.clientId){
               onLog(member.id + ' membro na sala');
               addMember(member.id);
            }
         });
      }
      startWebRTC();
   });
   // Adiciona à lista um usuário que acabou de entrar na sala
   room.on('member_join', member => {
      addMember(member.id);
   });
   // Exclui da lista o usuário que acabou de sair da sala
   room.on('member_leave', member => {
      let element = document.getElementById(member.id);
      if(element) element.remove();
      delete pc[member.id];
      onLog(member.id + ' saiu');
      setVideoLayout();
   });
});

// Envia uma mensagem pelo servidor de sinalização para os membros na  sala
function sendMessage(message, destinyId){
   if(destinyId == '') return;
   message.destiny = destinyId;
   drone.publish({
      room: roomName,
      message
   });
}

function startWebRTC(){
   onLog('WebRTC iniciado');
   room.on('data', (message, member) => {
      if(message.destiny != drone.clientId) return;
      if(message.sdp){
         onLog('SDP recebido de ' + member.id);
         pc[member.id].setRemoteDescription(message.sdp, () => {
            if(pc[member.id].remoteDescription.type === 'offer'){
               onLog('SDP type is offer');
               pc[member.id].createAnswer().then(answer => pc[member.id].setLocalDescription(answer)).then(() => sendMessage({'sdp': pc[member.id].localDescription}, member.id)).catch(err => onLog(err));
            }
         });
      }else if(message.candidate){
         onLog('Candidate recebido de ' + member.id);
         pc[member.id].addIceCandidate(message.candidate).catch(err => onLog(err));
      }
   });
}
